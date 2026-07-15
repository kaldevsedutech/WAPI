// Google Sheets Apps Script for WAPIMI Contact Us form submissions.
//
// Setup:
// 1. Open your Google Sheet.
// 2. Go to Extensions > Apps Script.
// 3. Paste this code and save.
// 4. Deploy > New deployment > Web app.
// 5. Execute as: Me.
// 6. Who has access: Anyone.
// 7. Copy the Web App URL and set it as GOOGLE_SHEETS_CONTACT_WEBHOOK_URL.

const SHEET_NAME = "Contact Inquiries";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const sheet = getOrCreateSheet_();

    sheet.appendRow([
      new Date(),
      payload.id || "",
      payload.name || "",
      payload.email || "",
      payload.subject || "",
      payload.message || "",
      payload.status || "new",
      payload.source || "public_contact_form",
      payload.createdAt || "",
    ]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function getOrCreateSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Received At",
      "Inquiry ID",
      "Name",
      "Email",
      "Subject",
      "Message",
      "Status",
      "Source",
      "Created At",
    ]);
  }

  return sheet;
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
