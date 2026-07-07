const REQUIRED = ['SPREADSHEET_ID', 'GOOGLE_APPLICATION_CREDENTIALS', 'CALENDAR_ID'];

for (const v of REQUIRED) {
  if (!process.env[v]) {
    throw new Error(`[config] Variable de entorno requerida no definida: ${v}. Verificá tu .env.local`);
  }
}
