const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { Op, DataTypes } = require('sequelize');
const { Sequelize } = require('sequelize');
const config = require('../config');
const DATABASE_URL = 'your-postgres-url-here'; // Replace with your own Postgres URL, e.g., from Supabase

const DATABASE = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  logging: false  // Change to console.log for detailed logs
});

// Define models
const AuthCred = DATABASE.define('AuthCred', {
  session_id: { type: DataTypes.STRING, primaryKey: true },
  creds: { type: DataTypes.TEXT }
});

const AuthKey = DATABASE.define('AuthKey', {
  session_id: { type: DataTypes.STRING },
  key_type: { type: DataTypes.STRING },
  key_id: { type: DataTypes.STRING },
  value: { type: DataTypes.TEXT }
}, {
  indexes: [{ unique: true, fields: ['session_id', 'key_type', 'key_id'] }]
});

async function usePostgresAuthState(sessionId) {
  await AuthCred.sync();
  await AuthKey.sync();

  let credRecord = await AuthCred.findByPk(sessionId);
  let creds = credRecord ? JSON.parse(credRecord.creds, BufferJSON.reviver) : initAuthCreds();

  const saveCreds = async () => {
    await AuthCred.upsert({
      session_id: sessionId,
      creds: JSON.stringify(creds, BufferJSON.replacer, 2)
    });
  };

  const keys = {
    async get(type, ids) {
      const keyRecords = await AuthKey.findAll({
        where: {
          session_id: sessionId,
          key_type: type,
          key_id: { [Op.in]: ids }
        }
      });
      return keyRecords.reduce((dict, r) => {
        dict[r.key_id] = JSON.parse(r.value, BufferJSON.reviver);
        return dict;
      }, {});
    },
    async set(data) {
      const operations = [];
      for (const type in data) {
        for (const id in data[type]) {
          const value = data[type][id];
          operations.push(AuthKey.upsert({
            session_id: sessionId,
            key_type: type,
            key_id: id,
            value: JSON.stringify(value, BufferJSON.replacer, 2)
          }));
        }
      }
      await Promise.all(operations);
    }
  };

  return { state: { creds, keys }, saveCreds };
}

module.exports = { usePostgresAuthState, DATABASE };
