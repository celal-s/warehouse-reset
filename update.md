 Product Differentiation Fix - Summary                                                          
                                                                                                
 The Problem                                                                                    
                                                                                                
 Currently, inventory cannot distinguish between the same product listed on different           
 marketplaces. For example:                                                                     
 - Client 561 imports ASIN 12345 for UK marketplace                                             
 - Client 561 imports ASIN 12345 for CA marketplace                                             
 - When inventory is received, it's tracked as "Client 561 + Product 12345" without knowing     
 which marketplace                                                                              
                                                                                                
 This breaks when:                                                                              
 - Same client has same product on multiple marketplaces (UK vs CA)                             
 - Different clients have same product (Client 412 vs Client 561 both selling ASIN 12345)       
                                                                                                
 The Business Rule                                                                              
                                                                                                
 Product uniqueness = Client + ASIN + Marketplace                                               
 ┌────────┬────────┬─────────────┬───────┬─────────────────────┐                                
 │ Client │  ASIN  │ Marketplace │ FNSKU │ Should Be Separate? │                                
 ├────────┼────────┼─────────────┼───────┼─────────────────────┤                                
 │ 561    │ B12345 │ UK          │ X001A │ Yes - unique        │                                
 ├────────┼────────┼─────────────┼───────┼─────────────────────┤                                
 │ 561    │ B12345 │ CA          │ X001B │ Yes - unique        │                                
 ├────────┼────────┼─────────────┼───────┼─────────────────────┤                                
 │ 412    │ B12345 │ UK          │ X001C │ Yes - unique        │                                
 ├────────┼────────┼─────────────┼───────┼─────────────────────┤                                
 │ 412    │ B12345 │ CA          │ X001D │ Yes - unique        │                                
 └────────┴────────┴─────────────┴───────┴─────────────────────┘                                
 Each row is a distinct "listing" that should have separate inventory tracking.                 
                                                                                                
 The Solution                                                                                   
                                                                                                
 Inventory needs to track at the listing level, not just product + client.                      
                                                                                                
 A "listing" is the combination of: Product + Client + Marketplace                              
                                                                                                
 This already exists in the system as client_product_listings - we just need to connect         
 inventory to it.                                                                               
                                                                                                
 What Changes                                                                                   
                                                                                                
 Backend (7 files)                                                                              
                                                                                                
 1. Database migration - Connect inventory to listings                                          
 2. Inventory service - Accept listing when receiving items                                     
 3. Inventory routes - Update all queries to use listings                                       
 4. Product routes - Include listing info in responses                                          
 5. Client routes - Update inventory queries                                                    
 6. Search service - Return listing ID in search results                                        
 7. Admin routes - Update dashboard statistics                                                  
                                                                                                
 Frontend (2 files)                                                                             
                                                                                                
 1. Scan page - When employee selects client+marketplace, use that listing                      
 2. API client - Pass listing ID instead of product + client                                    
                                                                                                
 How It Works After Fix                                                                         
                                                                                                
 Employee Scan Flow:                                                                            
 1. Scan product by UPC                                                                         
 2. See list of client listings (shows: Client 561/UK, Client 561/CA, Client 412/UK, etc.)      
 3. Select the specific listing (e.g., "Client 561 - UK - SKU: ABC123")                         
 4. Inventory is created linked to that specific listing                                        
 5. Inventory counts stay separate per marketplace                                              
                                                                                                
 Client Portal:                                                                                 
 - Client 561 sees UK inventory and CA inventory as separate line items                         
 - Each marketplace has its own count, condition tracking, decisions                            
                                                                                                
 Migration Path                                                                                 
                                                                                                
 1. Add new connection from inventory to listings (no downtime)                                 
 2. Backfill existing inventory with correct listing references                                 
 3. Deploy code changes                                                                         
 4. Clean up old structure                                                                      
                                                                                                
 Testing Checklist                                                                              
                                                                                                
 - Import same product for Client 561 on UK and CA marketplaces                                 
 - Receive inventory for UK listing - verify separate count                                     
 - Receive inventory for CA listing - verify separate count                                     
 - Client portal shows UK and CA as distinct inventory                                          
 - Employee scan shows both listings to choose from                                             
 - Dashboard totals are correct