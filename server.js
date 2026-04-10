const app = require('./src/app');
const { initDatabase } = require('./src/models');

const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[SERVER] Malware Analysis Platform is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`[DB] Failed to initialize database: ${error.message}`);
    process.exit(1);
  });
