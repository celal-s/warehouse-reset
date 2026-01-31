function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Receiving')
      .addItem('Open Receiving Interface', 'showReceivingInterface')
      .addToUi();
}

/**
 * NEW: Get list of available clients for selection
 * @return {Array} Array of client objects with id, name, and sheetId
 */
function getClientList() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName("Config");
    
    if (!configSheet) {
      throw new Error("Config sheet not found. Please run setup first.");
    }
    
    var configData = configSheet.getDataRange().getValues();
    var clients = [];
    
    // Skip header row
    for (var i = 1; i < configData.length; i++) {
      var clientId = configData[i][0];
      var clientName = configData[i][1] || clientId;
      var sheetId = configData[i][3];
      
      // Only include clients with valid sheet IDs
      if (clientId && sheetId && sheetId.toString().trim() !== "") {
        clients.push({
          id: clientId.toString(),
          name: clientName.toString(),
          sheetId: sheetId.toString()
        });
      }
    }
    
    Logger.log("Found " + clients.length + " valid clients");
    return clients;
  } catch (e) {
    Logger.log("Error in getClientList: " + e.toString());
    throw e;
  }
}

/**
 * NEW: Check if an order is within the 45-day limit
 * @param {Date} orderDate - The order date to check
 * @return {boolean} True if order is within 45 days, false otherwise
 */
function isOrderWithin45Days(orderDate) {  
  try {
    if (!orderDate) {
      // If no date available, assume it's recent for backwards compatibility
      return true;
    }
    
    // Handle empty strings, null, undefined
    if (orderDate === "" || orderDate === null || orderDate === undefined) {
      return true;
    }
    
    var today = new Date();
    var cutoffDate = new Date();
    cutoffDate.setDate(today.getDate() - 45);
    
    var parsedDate;
    
    // Handle different date formats from Google Sheets
    if (orderDate instanceof Date) {
      parsedDate = orderDate;
    } else if (typeof orderDate === 'string') {
      // Try parsing the string
      parsedDate = new Date(orderDate);
    } else if (typeof orderDate === 'number') {
      // Handle Excel serial dates (days since 1900-01-01)
      parsedDate = new Date(orderDate);
    } else {
      // Unknown format, assume recent for safety
      Logger.log("Unknown date format: " + typeof orderDate + " - " + orderDate);
      return true;
    }
    
    // Check if date parsing was successful
    if (isNaN(parsedDate.getTime())) {
      Logger.log("Failed to parse date: " + orderDate);
      return true; // Include orders with unparseable dates for safety
    }
    
    // Return true if order date is after cutoff date (within 45 days)
    return parsedDate >= cutoffDate;
  } catch (e) {
    Logger.log("Error in isOrderWithin45Days: " + e.toString() + " for date: " + orderDate);
    return true; // Include orders with date errors for safety
  }
}

/**
 * NEW: Search orders for a specific client only (MUCH FASTER) - NOW WITH 45-DAY FILTERING
 * @param {string} searchTerm - The term to search for
 * @param {string} clientId - The specific client ID to search
 * @return {Array} Array of matching order objects
 */
function searchSingleClientOrders(searchTerm, clientId) {
  // Validate inputs
  searchTerm = (searchTerm || "").toString().trim();
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }
  
  if (!clientId) {
    throw new Error("Client ID is required");
  }
  
  Logger.log("Searching for '" + searchTerm + "' in client: " + clientId);
  
  try {
    // Get client sheet ID from config
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName("Config");
    
    if (!configSheet) {
      throw new Error("Config sheet not found");
    }
    
    var configData = configSheet.getDataRange().getValues();
    var sheetId = null;
    var clientName = clientId;
    
    // Find the specific client
    for (var i = 1; i < configData.length; i++) {
      if (configData[i][0].toString() === clientId.toString()) {
        sheetId = configData[i][3];
        clientName = configData[i][1] || clientId;
        break;
      }
    }
    
    if (!sheetId) {
      throw new Error("Sheet ID not found for client " + clientId);
    }
    
    // Search only this client's sheet (much faster!)
    var results = searchClientSheetOptimized(sheetId, searchTerm, clientId, clientName);
    
    Logger.log("Found " + results.length + " results for client " + clientId);
    return results.slice(0, 20); // Limit to top 20 results
    
  } catch (e) {
    Logger.log("Error in searchSingleClientOrders: " + e.toString());
    throw e;
  }
}

/**
 * UPDATED: More efficient client sheet search with caching - NOW WITH 45-DAY FILTERING
 * @param {string} sheetId - The Google Sheet ID
 * @param {string} searchTerm - The term to search for
 * @param {string} clientId - The client ID
 * @param {string} clientName - The client name
 * @return {Array} Array of matching order objects
 */
function searchClientSheetOptimized(sheetId, searchTerm, clientId, clientName) {
  var results = [];
  
  try {
    Logger.log("searchClientSheetOptimized called with sheetId=" + sheetId + ", clientId=" + clientId);
    
    if (!sheetId || typeof sheetId !== 'string' || sheetId.trim() === '') {
      throw new Error("Invalid sheet ID for client " + clientId);
    }
    
    // Try to get cached data first
    var data = getCachedClientData(clientId, sheetId);
    
    if (data.length <= 1) {  // Only header or empty
      Logger.log("Sheet has no data rows");
      return results;
    }
    
    // Get header row to find column indices - SAME AS ORIGINAL
    var headers = data[0];
    Logger.log("Headers: " + headers.join(", "));
    
    var idColIndex = headers.indexOf("warehouse_order_line_ID");
    var poColIndex = headers.indexOf("purchase_order_no");
    var productColIndex = headers.indexOf("selling_marketplace_product_title");
    var vendorColIndex = headers.indexOf("vendor");
    var orderedUnitsColIndex = headers.indexOf("purchase_order_quantity_single_units");
    var receivedUnitsColIndex = headers.indexOf("received_single_units_quantity");
    var statusColIndex = headers.indexOf("warehouse_order_receiving_status");
    
    // NEW: Look for date columns (try multiple possible date column names)
    var dateColIndex = -1;
    var possibleDateColumns = [
      "order_date",
      "purchase_order_date", 
      "created_date",
      "date_created",
      "order_created_date",
      "po_date"
    ];
    
    for (var d = 0; d < possibleDateColumns.length; d++) {
      var index = headers.indexOf(possibleDateColumns[d]);
      if (index !== -1) {
        dateColIndex = index;
        Logger.log("Found date column: " + possibleDateColumns[d] + " at index " + index);
        break;
      }
    }
    
    if (dateColIndex === -1) {
      Logger.log("No date column found. Available columns: " + headers.join(", "));
      Logger.log("Will include all orders regardless of age.");
    }
    
    Logger.log("Column indices - ID: " + idColIndex + ", PO: " + poColIndex + 
               ", Product: " + productColIndex + ", Status: " + statusColIndex + ", Date: " + dateColIndex);
    
    // Skip if any required column is missing - SAME AS ORIGINAL
    if (idColIndex === -1 || poColIndex === -1 || productColIndex === -1) {
      throw new Error("Required columns missing in client sheet: warehouse_order_line_ID, purchase_order_no, or selling_marketplace_product_title");
    }
    
    // Convert search term to lowercase for case-insensitive search - SAME AS ORIGINAL
    var searchTermLower = searchTerm.toLowerCase();
    var matchCount = 0;
    var filteredByDateCount = 0;
    
    // Search through all rows - MAINTAINING ORIGINAL LOGIC EXACTLY + DATE FILTERING
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      // NEW: Check date filter first (skip if order is too old)
      if (dateColIndex !== -1 && row[dateColIndex] !== null && row[dateColIndex] !== undefined && row[dateColIndex] !== "") {
        var orderDate = row[dateColIndex];
        if (!isOrderWithin45Days(orderDate)) {
          filteredByDateCount++;
          continue; // Skip this order - it's older than 45 days
        }
      }
      
      // EXACT SAME LOGIC AS ORIGINAL - Check if row contains the search term in relevant columns
      var woLineId = (row[idColIndex] !== null && row[idColIndex] !== undefined) ? row[idColIndex].toString() : "";
      var poNumber = (row[poColIndex] !== null && row[poColIndex] !== undefined) ? row[poColIndex].toString() : "";
      var productTitle = (row[productColIndex] !== null && row[productColIndex] !== undefined) ? row[productColIndex].toString() : "";
      var vendor = (vendorColIndex !== -1 && row[vendorColIndex] !== null && row[vendorColIndex] !== undefined) ? row[vendorColIndex].toString() : "";
      
      // Handle status - default to "awaiting" if column not found or value is empty - SAME AS ORIGINAL
      var status = "awaiting";
      if (statusColIndex !== -1 && row[statusColIndex] !== null && row[statusColIndex] !== undefined) {
        status = row[statusColIndex].toString().toLowerCase();
      }
      
      // Skip completed orders unless explicitly searching for them - SAME AS ORIGINAL
      if (status === "complete" || status === "order cancelled") {
        continue;
      }
      
      // EXACT SAME MATCHING LOGIC AS ORIGINAL
      if (woLineId.toLowerCase().indexOf(searchTermLower) !== -1 ||
          poNumber.toLowerCase().indexOf(searchTermLower) !== -1 ||
          productTitle.toLowerCase().indexOf(searchTermLower) !== -1 ||
          vendor.toLowerCase().indexOf(searchTermLower) !== -1 ||
          clientId.toString().toLowerCase().indexOf(searchTermLower) !== -1) {
        
        matchCount++;
        
        // Add to results - SAME STRUCTURE AS ORIGINAL
        results.push({
          clientId: clientId,
          clientName: clientName, // Use passed clientName instead of function call for performance
          woLineId: woLineId,
          poNumber: poNumber,
          productTitle: productTitle,
          vendor: vendor,
          orderedUnits: (orderedUnitsColIndex !== -1) ? Number(row[orderedUnitsColIndex] || 0) : 0,
          receivedUnits: (receivedUnitsColIndex !== -1) ? Number(row[receivedUnitsColIndex] || 0) : 0,
          status: status,
          rowIndex: i + 1 // 1-based for Google Sheets
        });
      }
    }
    
    Logger.log("Found " + matchCount + " matching rows for client " + clientId);
    if (filteredByDateCount > 0) {
      Logger.log("Filtered out " + filteredByDateCount + " orders older than 45 days");
    }
    return results;
  } catch (e) {
    Logger.log("Error in searchClientSheetOptimized: " + e.toString());
    throw e; // Propagate error to the caller
  }
}

/**
 * NEW: Cached client data retrieval for better performance
 * @param {string} clientId - Client ID for cache key
 * @param {string} sheetId - Google Sheet ID
 * @param {boolean} forceRefresh - Force refresh cache
 * @return {Array} Client sheet data
 */
function getCachedClientData(clientId, sheetId, forceRefresh) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "client_search_data_" + clientId;
  
  // Try cache first unless forcing refresh
  if (!forceRefresh) {
    var cachedData = cache.get(cacheKey);
    if (cachedData) {
      try {
        var data = JSON.parse(cachedData);
        Logger.log("Retrieved client data from cache for: " + clientId);
        return data;
      } catch (e) {
        Logger.log("Cache data corrupted, fetching fresh data");
      }
    }
  }
  
  // Fetch fresh data - SAME AS ORIGINAL METHOD
  Logger.log("Fetching fresh data for client: " + clientId);
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  
  // Cache for 30 minutes (1800 seconds)
  try {
    cache.put(cacheKey, JSON.stringify(data), 1800);
    Logger.log("Cached client data for: " + clientId);
  } catch (e) {
    Logger.log("Failed to cache data: " + e.toString());
    // Continue even if caching fails
  }
  
  return data;
}

/**
 * UPDATED: Multi-client search for backwards compatibility - NOW WITH 45-DAY FILTERING
 */
function searchWarehouseOrders(searchTerm) {
  // Trim and validate search term
  searchTerm = (searchTerm || "").toString().trim();
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }
  
  Logger.log("Using legacy multi-client search for: " + searchTerm);
  Logger.log("RECOMMENDATION: Use client selection for much better performance");
  
  try {
    // Get all client configurations from Config sheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName("Config");
    
    if (!configSheet) {
      throw new Error("Config sheet not found. Please run setup first.");
    }
    
    var configData = configSheet.getDataRange().getValues();
    configData.shift(); // Remove header row
    
    var results = [];
    var errors = [];
    
    // Search across all client sheets
    for (var i = 0; i < configData.length; i++) {
      var clientId = (configData[i][0] || "").toString();
      var clientName = configData[i][1] || clientId;
      var sheetId = (configData[i][3] || "").toString();
      
      if (sheetId && sheetId.trim() !== "") {
        try {
          // Use the updated searchClientSheet function with date filtering
          var clientResults = searchClientSheet(sheetId, searchTerm, clientId);
          if (Array.isArray(clientResults)) {
            results = results.concat(clientResults);
          }
        } catch (e) {
          Logger.log("Error searching client " + clientId + ": " + e.toString());
          errors.push("Client " + clientId + ": " + e.message);
        }
      }
    }
    
    if (results.length === 0 && errors.length > 0) {
      throw new Error("Search failed: " + errors.join("; "));
    }
    
    return results.slice(0, 20);
  } catch (e) {
    Logger.log("Error in searchWarehouseOrders: " + e.toString());
    throw e;
  }
}

/**
 * UPDATED: Keep original searchClientSheet function for legacy mode - NOW WITH 45-DAY FILTERING
 */
function searchClientSheet(sheetId, searchTerm, clientId) {
  var results = [];
  
  try {
    Logger.log("searchClientSheet called with sheetId=" + sheetId + ", clientId=" + clientId);
    
    if (!sheetId || typeof sheetId !== 'string' || sheetId.trim() === '') {
      throw new Error("Invalid sheet ID for client " + clientId);
    }
    
    // Open the client's sheet
    var ss;
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      throw new Error("Could not open spreadsheet. Check the Sheet ID and permissions.");
    }
    
    if (!ss) {
      throw new Error("Could not open spreadsheet with ID: " + sheetId);
    }
    
    var clientSheet = ss.getSheets()[0]; // Assuming first sheet
    if (!clientSheet) {
      throw new Error("Could not find first sheet in spreadsheet: " + sheetId);
    }
    
    Logger.log("Successfully opened client sheet: " + clientSheet.getName());
    
    // Get all data
    var data = clientSheet.getDataRange().getValues();
    Logger.log("Retrieved " + data.length + " rows of data");
    
    if (data.length <= 1) {  // Only header or empty
      Logger.log("Sheet has no data rows");
      return results;
    }
    
    // Get header row to find column indices
    var headers = data[0];
    Logger.log("Headers: " + headers.join(", "));
    
    var idColIndex = headers.indexOf("warehouse_order_line_ID");
    var poColIndex = headers.indexOf("purchase_order_no");
    var productColIndex = headers.indexOf("selling_marketplace_product_title");
    var vendorColIndex = headers.indexOf("vendor");
    var orderedUnitsColIndex = headers.indexOf("purchase_order_quantity_single_units");
    var receivedUnitsColIndex = headers.indexOf("received_single_units_quantity");
    var statusColIndex = headers.indexOf("warehouse_order_receiving_status");
    
    // NEW: Look for date columns (try multiple possible date column names)
    var dateColIndex = -1;
    var possibleDateColumns = [
      "order_date",
      "purchase_order_date", 
      "created_date",
      "date_created",
      "order_created_date",
      "po_date"
    ];
    
    for (var d = 0; d < possibleDateColumns.length; d++) {
      var index = headers.indexOf(possibleDateColumns[d]);
      if (index !== -1) {
        dateColIndex = index;
        Logger.log("Found date column: " + possibleDateColumns[d] + " at index " + index);
        break;
      }
    }
    
    if (dateColIndex === -1) {
      Logger.log("No date column found. Available columns: " + headers.join(", "));
      Logger.log("Will include all orders regardless of age.");
    }
    
    Logger.log("Column indices - ID: " + idColIndex + ", PO: " + poColIndex + 
               ", Product: " + productColIndex + ", Status: " + statusColIndex + ", Date: " + dateColIndex);
    
    // Skip if any required column is missing
    if (idColIndex === -1 || poColIndex === -1 || productColIndex === -1) {
      throw new Error("Required columns missing in client sheet: warehouse_order_line_ID, purchase_order_no, or selling_marketplace_product_title");
    }
    
    // Convert search term to lowercase for case-insensitive search
    var searchTermLower = searchTerm.toLowerCase();
    var matchCount = 0;
    var filteredByDateCount = 0;
    
    // Search through all rows
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      // NEW: Check date filter first (skip if order is too old)
      if (dateColIndex !== -1 && row[dateColIndex] !== null && row[dateColIndex] !== undefined && row[dateColIndex] !== "") {
        var orderDate = row[dateColIndex];
        if (!isOrderWithin45Days(orderDate)) {
          filteredByDateCount++;
          continue; // Skip this order - it's older than 45 days
        }
      }
      
      // Check if row contains the search term in relevant columns
      var woLineId = (row[idColIndex] !== null && row[idColIndex] !== undefined) ? row[idColIndex].toString() : "";
      var poNumber = (row[poColIndex] !== null && row[poColIndex] !== undefined) ? row[poColIndex].toString() : "";
      var productTitle = (row[productColIndex] !== null && row[productColIndex] !== undefined) ? row[productColIndex].toString() : "";
      var vendor = (vendorColIndex !== -1 && row[vendorColIndex] !== null && row[vendorColIndex] !== undefined) ? row[vendorColIndex].toString() : "";
      
      // Handle status - default to "awaiting" if column not found or value is empty
      var status = "awaiting";
      if (statusColIndex !== -1 && row[statusColIndex] !== null && row[statusColIndex] !== undefined) {
        status = row[statusColIndex].toString().toLowerCase();
      }
      
      // Skip completed orders unless explicitly searching for them
      if (status === "complete" || status === "order cancelled") {
        continue;
      }
      
      // Check if any field matches the search term
      if (woLineId.toLowerCase().indexOf(searchTermLower) !== -1 ||
          poNumber.toLowerCase().indexOf(searchTermLower) !== -1 ||
          productTitle.toLowerCase().indexOf(searchTermLower) !== -1 ||
          vendor.toLowerCase().indexOf(searchTermLower) !== -1 ||
          clientId.toString().toLowerCase().indexOf(searchTermLower) !== -1) {
        
        matchCount++;
        
        // Add to results
        results.push({
          clientId: clientId,
          clientName: getClientNameById(clientId), 
          woLineId: woLineId,
          poNumber: poNumber,
          productTitle: productTitle,
          vendor: vendor,
          orderedUnits: (orderedUnitsColIndex !== -1) ? Number(row[orderedUnitsColIndex] || 0) : 0,
          receivedUnits: (receivedUnitsColIndex !== -1) ? Number(row[receivedUnitsColIndex] || 0) : 0,
          status: status,
          rowIndex: i + 1 // 1-based for Google Sheets
        });
      }
    }
    
    Logger.log("Found " + matchCount + " matching rows for client " + clientId);
    if (filteredByDateCount > 0) {
      Logger.log("Filtered out " + filteredByDateCount + " orders older than 45 days");
    }
    return results;
  } catch (e) {
    Logger.log("Error in searchClientSheet: " + e.toString());
    throw e; // Propagate error to the caller
  }
}

// Keep all existing functions COMPLETELY UNCHANGED to ensure data compatibility
function testClientLogSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("Config");
  
  if (!configSheet) {
    Logger.log("Config sheet not found!");
    return "Config sheet not found!";
  }
  
  var configData = configSheet.getDataRange().getValues();
  var results = [];
  
  for (var i = 1; i < configData.length; i++) {
    var clientId = configData[i][0];
    var clientName = configData[i][1];
    var sheetId = configData[i][3];
    
    if (!sheetId) {
      results.push("Client " + clientId + " (" + clientName + ") - No sheet ID found");
      continue;
    }
    
    try {
      var receivingSheet = setupClientReceivingLog(sheetId);
      results.push("Client " + clientId + " (" + clientName + ") - Successfully set up receiving log");
    } catch (e) {
      results.push("Client " + clientId + " (" + clientName + ") - Error: " + e.message);
    }
  }
  
  Logger.log(results.join("\n"));
  return results.join("\n");
}

function testSearch() {
  var results = searchSingleClientOrders("561", "561"); // Updated to use new function
  Logger.log(results);
}

function getUserEmail() {
  return Session.getActiveUser().getEmail();
}

function getCurrentUserInfo() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) {
      return { email: "unknown@example.com" };
    }
    return { email: email };
  } catch (e) {
    Logger.log("Error getting user email: " + e.toString());
    return { email: "unknown@example.com" };
  }
}

function checkConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("Config");
  
  if (!configSheet) {
    Logger.log("Config sheet not found");
    return "Config sheet not found";
  }
  
  var configData = configSheet.getDataRange().getValues();
  Logger.log("Config sheet has " + configData.length + " rows including header");
  
  for (var i = 1; i < configData.length; i++) {
    Logger.log("Row " + i + ": Client ID = " + configData[i][0] + 
               ", Client Name = " + configData[i][1] + 
               ", URL = " + configData[i][2] + 
               ", Sheet ID = " + configData[i][3]);
  }
  
  return "Config check complete";
}

/**
 * ORIGINAL: setupReceivingSheet - COMPLETELY UNCHANGED to ensure data compatibility
 */
function setupReceivingSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var receivingSheet = ss.getSheetByName("Receiving Log");
  if (!receivingSheet) {
    receivingSheet = ss.insertSheet("Receiving Log");
    
    var headers = [
      "receiving_ID", "receiving_date", "warehouse_order_line_ID", "purchase_order_no", 
      "vendor", "sku", "asin", "selling_marketplace_product_title", "hazmat", "prep", 
      "parcel_count", "parcel_received", "client_code", "received_single_units_quantity", 
      "received_single_units_damaged_quantity", "tracking_number", "notes", "receiver",
      "selling_marketplace_bundle_count", "total_sellable_units"
    ];
    
    receivingSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    receivingSheet.getRange(1, 1, 1, headers.length).setBackground("#D9D9D9").setFontWeight("bold");
    
    var receivedQtyColumn = headers.indexOf("received_single_units_quantity") + 1;
    var damagedQtyColumn = headers.indexOf("received_single_units_damaged_quantity") + 1;
    var bundleCountColumn = headers.indexOf("selling_marketplace_bundle_count") + 1;
    var sellableUnitsColumn = headers.indexOf("total_sellable_units") + 1;
    
    if (receivedQtyColumn > 0) {
      receivingSheet.getRange(2, receivedQtyColumn, 999).setDataValidation(
        SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).build()
      );
    }
    
    if (damagedQtyColumn > 0) {
      receivingSheet.getRange(2, damagedQtyColumn, 999).setDataValidation(
        SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).build()
      );
    }
    
    if (bundleCountColumn > 0) {
      receivingSheet.getRange(2, bundleCountColumn, 999).setDataValidation(
        SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(1).build()
      );
    }
    
    if (sellableUnitsColumn > 0) {
      receivingSheet.getRange(2, sellableUnitsColumn, 999).setDataValidation(
        SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).build()
      );
    }
  } else {
    var headers = receivingSheet.getRange(1, 1, 1, receivingSheet.getLastColumn()).getValues()[0];
    
    var hasBundleCount = headers.indexOf("selling_marketplace_bundle_count") >= 0;
    var hasSellableUnits = headers.indexOf("total_sellable_units") >= 0;
    
    if (!hasBundleCount || !hasSellableUnits) {
      var lastCol = receivingSheet.getLastColumn();
      var newHeaders = [];
      if (!hasBundleCount) {
        newHeaders.push("selling_marketplace_bundle_count");
      }
      if (!hasSellableUnits) {
        newHeaders.push("total_sellable_units");
      }
      
      if (newHeaders.length > 0) {
        receivingSheet.getRange(1, lastCol + 1, 1, newHeaders.length).setValues([newHeaders]);
        receivingSheet.getRange(1, lastCol + 1, 1, newHeaders.length).setBackground("#D9D9D9").setFontWeight("bold");
        
        for (var i = 0; i < newHeaders.length; i++) {
          var column = lastCol + 1 + i;
          if (newHeaders[i] === "selling_marketplace_bundle_count") {
            receivingSheet.getRange(2, column, 999).setDataValidation(
              SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(1).build()
            );
          } else if (newHeaders[i] === "total_sellable_units") {
            receivingSheet.getRange(2, column, 999).setDataValidation(
              SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).build()
            );
          }
        }
      }
    }
  }
  
  var configSheet = ss.getSheetByName("Config");
  if (!configSheet) {
    configSheet = ss.insertSheet("Config");
    
    configSheet.getRange("A1:D1").setValues([["Client ID", "Client Name", "Mirrored Sheet URL", "Mirrored Sheet ID"]]);
    configSheet.getRange("A1:D1").setBackground("#D9D9D9").setFontWeight("bold");
    
    configSheet.getRange("A2:D2").setValues([["561", "Client 561", "", ""]]);
  } else {
    var configData = configSheet.getDataRange().getValues();
    if (configData.length < 2) {
      configSheet.getRange("A2:D2").setValues([["561", "Client 561", "", ""]]);
    }
    
    var headers = configData[0];
    var expectedHeaders = ["Client ID", "Client Name", "Mirrored Sheet URL", "Mirrored Sheet ID"];
    var headersCorrect = true;
    
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (headers[i] !== expectedHeaders[i]) {
        headersCorrect = false;
        break;
      }
    }
    
    if (!headersCorrect) {
      configSheet.getRange("A1:D1").setValues([expectedHeaders]);
      configSheet.getRange("A1:D1").setBackground("#D9D9D9").setFontWeight("bold");
    }
  }
  
  return "Setup completed successfully";
}

function showReceivingInterface() {
  setupReceivingSheet();
  
  var html = HtmlService.createHtmlOutputFromFile('ReceivingInterface')
      .setWidth(1000)
      .setHeight(700)
      .setTitle('Warehouse Receiving');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Warehouse Receiving');
}

function getClientNameById(clientId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName("Config");
    
    if (!configSheet) {
      return clientId;
    }
    
    var configData = configSheet.getDataRange().getValues();
    
    for (var i = 1; i < configData.length; i++) {
      if (configData[i][0].toString() === clientId.toString()) {
        return configData[i][1] || clientId;
      }
    }
    
    return clientId;
  } catch (e) {
    Logger.log("Error in getClientNameById: " + e.toString());
    return clientId;
  }
}

function getOrderDetailsForClient(woLineId, clientId, rowIndex) {
  try {
    Logger.log("Calling getCachedOrderDetails");
    return getCachedOrderDetails(woLineId, clientId, rowIndex);
  } catch (e) {
    Logger.log("Error in getOrderDetailsForClient: " + e.toString());
    throw e;
  }
}

/**
 * ORIGINAL: getOrderDetails - COMPLETELY UNCHANGED to ensure data compatibility
 */
function getOrderDetails(woLineId, clientId, rowIndex) {
  try {
    Logger.log("Getting order details for: WO ID=" + woLineId + ", Client ID=" + clientId + ", Row=" + rowIndex);
    
    if (!woLineId || !clientId || !rowIndex) {
      throw new Error("Missing required parameters: warehouse order ID, client ID, or row index");
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName("Config");
    
    if (!configSheet) {
      throw new Error("Config sheet not found");
    }
    
    var configData = configSheet.getDataRange().getValues();
    var clientSheetId = null;
    
    for (var i = 1; i < configData.length; i++) {
      if (configData[i][0].toString() === clientId.toString()) {
        clientSheetId = configData[i][3];
        break;
      }
    }
    
    if (!clientSheetId) {
      throw new Error("Client sheet ID not found for client " + clientId);
    }
    
    var clientSheet;
    try {
      var clientSpreadsheet = SpreadsheetApp.openById(clientSheetId);
      clientSheet = clientSpreadsheet.getSheets()[0];
    } catch (e) {
      throw new Error("Could not open client spreadsheet: " + e.message);
    }
    
    var allData = clientSheet.getDataRange().getValues();
    var headers = allData[0];
    
    var columnMap = {};
    for (var i = 0; i < headers.length; i++) {
      if (headers[i]) {
        columnMap[headers[i]] = i;
      }
    }
    
    var requiredColumns = ["warehouse_order_line_ID", "purchase_order_no", "selling_marketplace_product_title", "vendor"];
    for (var i = 0; i < requiredColumns.length; i++) {
      if (!(requiredColumns[i] in columnMap)) {
        throw new Error("Required column '" + requiredColumns[i] + "' not found in client sheet");
      }
    }
    
    var orderRow = null;
    
    if (rowIndex > 0 && rowIndex < allData.length) {
      var rowData = allData[rowIndex];
      if (rowData[columnMap["warehouse_order_line_ID"]].toString() === woLineId.toString()) {
        orderRow = rowData;
      }
    }
    
    if (!orderRow) {
      for (var i = 1; i < allData.length; i++) {
        if (allData[i][columnMap["warehouse_order_line_ID"]].toString() === woLineId.toString()) {
          orderRow = allData[i];
          break;
        }
      }
    }
    
    if (!orderRow) {
      throw new Error("Order " + woLineId + " not found in spreadsheet");
    }
    
    var simpleOrder = {
      warehouse_order_line_ID: orderRow[columnMap["warehouse_order_line_ID"]].toString(),
      purchase_order_no: orderRow[columnMap["purchase_order_no"]] ? orderRow[columnMap["purchase_order_no"]].toString() : "",
      selling_marketplace_product_title: orderRow[columnMap["selling_marketplace_product_title"]] ? orderRow[columnMap["selling_marketplace_product_title"]].toString() : "",
      vendor: orderRow[columnMap["vendor"]] ? orderRow[columnMap["vendor"]].toString() : "",
      clientId: clientId.toString()
    };
    
    var numericFields = ["purchase_order_quantity_single_units", "received_single_units_quantity", 
                        "received_single_units_damaged_quantity", "purchase_bundle_count", 
                        "purchase_order_quantity", "selling_marketplace_bundle_count"];
    for (var i = 0; i < numericFields.length; i++) {
      var field = numericFields[i];
      if (field in columnMap) {
        simpleOrder[field] = Number(orderRow[columnMap[field]] || 0);
      } else {
        simpleOrder[field] = 0;
      }
    }
    
    var optionalFields = ["is_hazmat", "selling_marketplace_client_SKU", "selling_marketplace_ASIN", "selling_marketplace", "notes_to_warehouse"];
    
    for (var i = 0; i < optionalFields.length; i++) {
      var field = optionalFields[i];
      if (field in columnMap) {
        simpleOrder[field] = orderRow[columnMap[field]] ? orderRow[columnMap[field]].toString() : "";
      }
    }
    
    var receivingLog = ss.getSheetByName("Receiving Log");
    var previousEntries = [];
    var totalReceived = 0;
    var totalDamaged = 0;
    
    if (receivingLog && receivingLog.getLastRow() > 1) {
      var logData = receivingLog.getDataRange().getValues();
      var logHeaders = logData[0];
      var woIdColIndex = logHeaders.indexOf("warehouse_order_line_ID");
      
      if (woIdColIndex !== -1) {
        for (var i = 1; i < logData.length; i++) {
          if (logData[i][woIdColIndex] && logData[i][woIdColIndex].toString() === woLineId.toString()) {
            var entry = {
              receiving_date: logData[i][logHeaders.indexOf("receiving_date")] || new Date(),
              received_single_units_quantity: Number(logData[i][logHeaders.indexOf("received_single_units_quantity")] || 0),
              received_single_units_damaged_quantity: Number(logData[i][logHeaders.indexOf("received_single_units_damaged_quantity")] || 0),
              receiver: logData[i][logHeaders.indexOf("receiver")] || "",
              notes: logData[i][logHeaders.indexOf("notes")] || ""
            };
            
            previousEntries.push(entry);
            totalReceived += entry.received_single_units_quantity;
            totalDamaged += entry.received_single_units_damaged_quantity;
          }
        }
      }
    }

    if (!simpleOrder || !simpleOrder.warehouse_order_line_ID) {
      throw new Error("Failed to build valid order details object");
    }
    
    var result = {
      orderDetails: simpleOrder,
      previousEntries: previousEntries,
      totalReceived: totalReceived,
      totalDamaged: totalDamaged
    };
    
    Logger.log("Returning simplified order data: " + JSON.stringify(simpleOrder));
    return result;
    
  } catch (e) {
    Logger.log("ERROR in getOrderDetails: " + e.toString());
    Logger.log("woLineId: " + woLineId);
    Logger.log("clientId: " + clientId);
    Logger.log("rowIndex: " + rowIndex);
    
    throw new Error("Error getting order details: " + e.message);
  }
}

/**
 * CRITICAL: submitReceiving - MUST WRITE TO MAIN LOG FIRST, CLIENT LOG SECOND
 * This function MUST write data exactly the same as before to the main "Receiving Log" sheet
 */
function submitReceiving(formData) {
  try {
    Logger.log("=== SUBMIT RECEIVING START ===");
    Logger.log("Form data received: " + JSON.stringify(formData));
    
    // EXACT SAME validation as original
    if (!formData) {
      throw new Error("No form data provided");
    }
    
    if (!formData.warehouse_order_line_ID) {
      throw new Error("Missing warehouse order line ID");
    }
    
    if (!formData.client_code) {
      throw new Error("Missing client code");
    }
    
    // EXACT SAME numeric conversions as original
    var receivedUnits = Math.max(0, Number(formData.received_single_units_quantity) || 0);
    var damagedUnits = Math.max(0, Number(formData.received_single_units_damaged_quantity) || 0);
    var totalReceived = Math.max(0, Number(formData.total_received) || 0);
    var totalDamaged = Math.max(0, Number(formData.total_damaged) || 0);
    var orderedUnits = Math.max(0, Number(formData.purchase_order_quantity_single_units) || 0);
    var sellingBundleCount = Math.max(1, Number(formData.selling_marketplace_bundle_count) || 1);
    
    // EXACT SAME sellableUnits calculation as original
    var sellableUnits = Math.floor(receivedUnits / sellingBundleCount);
    
    // EXACT SAME form data updates as original
    formData.received_single_units_quantity = receivedUnits;
    formData.received_single_units_damaged_quantity = damagedUnits;
    
    // EXACT SAME validation as original
    if (receivedUnits === 0 && damagedUnits === 0) {
      throw new Error("At least one unit (good or damaged) must be received");
    }
    
    if (!formData.receiver) {
      throw new Error("Receiver name is required");
    }
    
    Logger.log("Validation passed. Getting main receiving sheet...");
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var receivingSheet = ss.getSheetByName("Receiving Log");
    
    if (!receivingSheet) {
      Logger.log("Receiving Log sheet not found, creating it...");
      setupReceivingSheet();
      receivingSheet = ss.getSheetByName("Receiving Log");
      if (!receivingSheet) {
        throw new Error("Could not create or access Receiving Log sheet");
      }
    }
    
    Logger.log("Got main receiving sheet: " + receivingSheet.getName());
    
    // EXACT SAME receivingId generation as original
    var receivingId = "RCV" + Math.floor(100000 + Math.random() * 900000);
    Logger.log("Generated receiving ID: " + receivingId);
    
    // EXACT SAME headers handling as original
    var headers = receivingSheet.getRange(1, 1, 1, receivingSheet.getLastColumn()).getValues()[0];
    Logger.log("Headers from main sheet: " + headers.join(", "));
    
    var hasBundleCount = headers.indexOf("selling_marketplace_bundle_count") >= 0;
    var hasSellableUnits = headers.indexOf("total_sellable_units") >= 0;
    Logger.log("Has bundle count column: " + hasBundleCount);
    Logger.log("Has sellable units column: " + hasSellableUnits);
    
    // EXACT SAME newRow construction as original - CRITICAL FOR DATA COMPATIBILITY
    var newRow = [
      receivingId,
      new Date(), // current date
      formData.warehouse_order_line_ID,
      formData.purchase_order_no || "",
      formData.vendor || "",
      formData.sku || "",
      formData.asin || "",
      formData.selling_marketplace_product_title || "",
      formData.hazmat || "No",
      formData.prep || "", // Keep but no longer used
      Number(formData.parcel_count) || 1, // Keep but no longer used
      Number(formData.parcel_received) || 1, // Keep but no longer used
      formData.client_code,
      receivedUnits,
      damagedUnits,
      formData.tracking_number || "",
      formData.notes || "",
      formData.receiver || ""
    ];
    
    Logger.log("Base newRow created with " + newRow.length + " elements");
    
    // EXACT SAME conditional column additions as original
    if (hasBundleCount) {
      newRow.push(sellingBundleCount);
      Logger.log("Added selling_marketplace_bundle_count: " + sellingBundleCount);
    }
    
    if (hasSellableUnits) {
      newRow.push(sellableUnits);
      Logger.log("Added total_sellable_units: " + sellableUnits);
    }
    
    Logger.log("Final newRow has " + newRow.length + " elements: " + JSON.stringify(newRow));
    
    // 🚨🚨🚨 CRITICAL: MAIN LOG ENTRY - THIS MUST HAPPEN FIRST 🚨🚨🚨
    Logger.log("=== WRITING TO MAIN RECEIVING LOG ===");
    try {
      receivingSheet.appendRow(newRow);
      Logger.log("✅ SUCCESS: Written to main Receiving Log sheet");
    } catch (appendError) {
      Logger.log("❌ CRITICAL ERROR: Failed to write to main Receiving Log: " + appendError.toString());
      throw new Error("Failed to write to main Receiving Log: " + appendError.message);
    }
    
    // EXACT SAME status calculation as original
    var newTotalReceived = totalReceived + receivedUnits;
    var newTotalDamaged = totalDamaged + damagedUnits;
    var totalSellable = newTotalReceived + newTotalDamaged;
    
    var status;
    if (totalSellable === 0) {
      status = "awaiting";
    } else if (totalSellable < orderedUnits) {
      status = "partial";
    } else if (totalSellable === orderedUnits) {
      status = "complete";
    } else {
      status = "extra units";
    }
    
    Logger.log("Calculated status: " + status + " (Total sellable: " + totalSellable + " vs Ordered: " + orderedUnits + ")");
    
    // EXACT SAME logEntry creation as original
    var logEntry = {
      headers: headers,
      values: newRow
    };
    
    // SECONDARY: Try to add to client log (this is optional and should NOT affect main log)
    Logger.log("=== ATTEMPTING CLIENT LOG (OPTIONAL) ===");
    var clientLogWarning = null;
    try {
      var clientLogSuccess = addToClientReceivingLog(formData.client_code, logEntry);
      if (!clientLogSuccess) {
        clientLogWarning = "The receiving was logged to main sheet, but could not be added to the client's receiving log. The PO sheet may not show updated quantities.";
        Logger.log("⚠️ WARNING: Client log failed but main log succeeded");
      } else {
        Logger.log("✅ SUCCESS: Also written to client receiving log");
      }
    } catch (logError) {
      Logger.log("⚠️ WARNING: Client log error (main log still succeeded): " + logError.toString());
      clientLogWarning = "The receiving was logged to main sheet, but could not be added to the client's receiving log: " + logError.message;
    }
    
    // Clear cache for this client to ensure fresh data on next search
    try {
      var cache = CacheService.getScriptCache();
      var cacheKey = "client_search_data_" + formData.client_code;
      cache.remove(cacheKey);
      Logger.log("✅ Cleared cache for client: " + formData.client_code);
    } catch (e) {
      Logger.log("⚠️ Could not clear cache: " + e.toString());
    }
    
    Logger.log("=== SUBMIT RECEIVING SUCCESS ===");
    
    // EXACT SAME return structure as original
    if (clientLogWarning) {
      return {
        success: true,
        receivingId: receivingId,
        status: status,
        warning: clientLogWarning
      };
    }
    
    return {
      success: true,
      receivingId: receivingId,
      status: status
    };
  } catch (e) {
    Logger.log("❌ CRITICAL ERROR in submitReceiving: " + e.toString());
    throw e;
  }
}

/**
 * ORIGINAL: setupClientReceivingLog - COMPLETELY UNCHANGED
 */
function setupClientReceivingLog(clientSheetId) {
  try {
    if (!clientSheetId) {
      throw new Error("Missing client sheet ID");
    }
    
    var clientSpreadsheet;
    try {
      clientSpreadsheet = SpreadsheetApp.openById(clientSheetId);
    } catch (e) {
      throw new Error("Could not open client spreadsheet: " + e.message);
    }
    
    var receivingSheet = clientSpreadsheet.getSheetByName("Receiving Log");
    
    if (!receivingSheet) {
      receivingSheet = clientSpreadsheet.insertSheet("Receiving Log");
      
      var headers = [
        "receiving_ID", "receiving_date", "warehouse_order_line_ID", "purchase_order_no", 
        "vendor", "sku", "asin", "selling_marketplace_product_title", "hazmat", 
        "client_code", "received_single_units_quantity", "received_single_units_damaged_quantity", 
        "tracking_number", "notes", "receiver", "selling_marketplace_bundle_count", "total_sellable_units"
      ];
      
      receivingSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      receivingSheet.getRange(1, 1, 1, headers.length).setBackground("#D9D9D9").setFontWeight("bold");
      
      receivingSheet.setFrozenRows(1);
      receivingSheet.autoResizeColumns(1, headers.length);
      
      Logger.log("Created Receiving Log sheet in client spreadsheet: " + clientSheetId);
    } else {
      Logger.log("Receiving Log sheet already exists in client spreadsheet: " + clientSheetId);
    }
    
    return receivingSheet;
  } catch (e) {
    Logger.log("Error in setupClientReceivingLog: " + e.toString());
    throw e;
  }
}

/**
 * ORIGINAL: addToClientReceivingLog - COMPLETELY UNCHANGED
 */
function addToClientReceivingLog(clientId, logEntry) {
  try {
    if (!clientId || !logEntry) {
      throw new Error("Missing client ID or log entry data");
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName("Config");
    
    if (!configSheet) {
      throw new Error("Config sheet not found");
    }
    
    var configData = configSheet.getDataRange().getValues();
    var clientSheetId = null;
    
    for (var i = 1; i < configData.length; i++) {
      if (configData[i][0].toString() === clientId.toString()) {
        clientSheetId = configData[i][3];
        break;
      }
    }
    
    if (!clientSheetId) {
      throw new Error("Client sheet ID not found for client " + clientId);
    }
    
    var clientReceivingSheet = setupClientReceivingLog(clientSheetId);
    
    var headers = clientReceivingSheet.getRange(1, 1, 1, clientReceivingSheet.getLastColumn()).getValues()[0];
    
    var rowData = [];
    for (var i = 0; i < headers.length; i++) {
      var headerIndex = logEntry.headers.indexOf(headers[i]);
      if (headerIndex !== -1) {
        rowData.push(logEntry.values[headerIndex]);
      } else {
        rowData.push("");
      }
    }
    
    clientReceivingSheet.appendRow(rowData);
    Logger.log("Added receiving entry to client receiving log for client: " + clientId);
    
    return true;
  } catch (e) {
    Logger.log("Error in addToClientReceivingLog: " + e.toString());
    return false;
  }
}

/**
 * ORIGINAL: getCachedOrderDetails - COMPLETELY UNCHANGED
 */
function getCachedOrderDetails(woLineId, clientId, rowIndex) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "order_" + clientId + "_" + woLineId;
  
  var cachedData = cache.get(cacheKey);
  if (cachedData) {
    try {
      var data = JSON.parse(cachedData);
      Logger.log("Retrieved order details from cache");
      return data;
    } catch (e) {
      Logger.log("Error parsing cached data: " + e.toString());
    }
  }
  
  var data = getOrderDetails(woLineId, clientId, rowIndex);
  
  if (data) {
    try {
      cache.put(cacheKey, JSON.stringify(data), 600);
      Logger.log("Stored order details in cache");
    } catch (e) {
      Logger.log("Error storing in cache: " + e.toString());
    }
  }
  
  return data;
}