const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { Op, DataTypes } = require('sequelize');
const { Sequelize } = require('sequelize');

const DATABASE_URL = "postgresql://postgres.cnhoywuxgnzhfurjhcwo:m0RxCx8470yUFP8V@aws-1-us-east-1.pooler.supabase.com:6543/postgres";

const DATABASE = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

const AuthCred = DATABASE.define('AuthCred', {
  session_id: { type: DataTypes.STRING, primaryKey: true },
  creds: { type: DataTypes.TEXT }
});

const AuthKey = DATABASE.define('AuthKey', {
  session_id: { type: DataTypes.STRING },
  key_type: { type: DataTypes.STRING },
  key_id: { type: DataTypes.STRING },
  value: { type: DataTypes.TEXT }
}, { indexes: [{ unique: true, fields: ['session_id', 'key_type', 'key_id'] }] });

async function usePostgresAuthState(sessionId) {
  await AuthCred.sync();
  await AuthKey.sync();

  const credRecord = await AuthCred.findByPk(sessionId);
  const creds = credRecord ? JSON.parse(credRecord.creds, BufferJSON.reviver) : initAuthCreds();

  const saveCreds = async () => {
    await AuthCred.upsert({
      session_id: sessionId,
      creds: JSON.stringify(creds, BufferJSON.replacer, 2)
    });
  };

  const keys = {
    async get(type, ids) {
      const rows = await AuthKey.findAll({
        where: { session_id: sessionId, key_type: type, key_id: { [Op.in]: ids } }
      });
      return rows.reduce((obj, r) => {
        obj[r.key_id] = JSON.parse(r.value, BufferJSON.reviver);
        return obj;
      }, {});
    },
    async set(data) {
      const ops = [];
      for (const type in data) {
        for (const id in data[type]) {
          ops.push(AuthKey.upsert({
            session_id: sessionId,
            key_type: type,
            key_id: id,
            value: JSON.stringify(data[type][id], BufferJSON.replacer, 2)
          }));
        }
      }
      await Promise.all(ops);
    }
  };

  return { state: { creds, keys }, saveCreds };
}

module.exports = { usePostgresAuthState, DATABASE };
