const db = require('../db');

const activityService = {
  async log(entityType, entityId, action, actorType, actorIdentifier, details = {}) {
    await db.query(`
      INSERT INTO activity_log (entity_type, entity_id, action, actor_type, actor_identifier, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [entityType, entityId, action, actorType, actorIdentifier, JSON.stringify(details)]);
  },

  async getRecentActivity(limit = 50) {
    const result = await db.query(`
      SELECT * FROM activity_log
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  },

  async getActivityByEntity(entityType, entityId) {
    const result = await db.query(`
      SELECT * FROM activity_log
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
    `, [entityType, entityId]);
    return result.rows;
  }
};

module.exports = activityService;
