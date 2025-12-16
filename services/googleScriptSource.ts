
export const GOOGLE_SCRIPT_CODE = `
/* 
   RDMS Data Sync v1.2 (Robust Patch)
   ----------------------------------
   - Fixes Duplicate Entries by normalizing ID comparisons
   - Increases concurrency limits for reliable syncing
*/

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 30 seconds for other requests to finish before failing
  try {
      lock.waitLock(30000); 
  } catch (e) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Server Busy - Try again later" }));
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var output = { success: true, message: "" };

    if (data.type === 'SETUP_DASHBOARD') {
      setupHeaders();
      output.message = "Sheets & Headers Initialized";
    }
    
    // --- PRODUCTION ---
    else if (data.type === 'JOB' || data.type === 'DELETE_JOB') {
      syncProduction(data);
      output.message = "Production Data Synced";
    }

    // --- BILLING ---
    else if (data.type === 'BILL' || data.type === 'DELETE_BILL') {
      syncBilling(data);
      output.message = "Billing Data Synced";
    }

    // --- SLITTING ---
    else if (data.type === 'SLITTING_JOB' || data.type === 'DELETE_SLITTING_JOB') {
      syncSlitting(data);
      output.message = "Slitting Data Synced";
    }

    // --- PLANNING ---
    else if (data.type === 'PLAN' || data.type === 'DELETE_PLAN') {
      syncPlanning(data);
      output.message = "Planning Data Synced";
    }

    return ContentService.createTextOutput(JSON.stringify(output));

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: err.toString() 
    }));
  } finally {
    lock.releaseLock();
  }
}

// --- HANDLERS ---

function syncProduction(data) {
  var sheet = getSheet("Production Data");
  if (!sheet) return;
  
  // Clean existing rows for this ID (Col A = Job No)
  deleteRowsById(sheet, 0, data.dispatchNo); 

  if (data.type === 'JOB') {
    data.rows.forEach(function(row) {
      sheet.appendRow([
        "'" + data.dispatchNo, // Force string to prevent date auto-format issues
        data.date,
        data.partyName,
        row.size,
        row.sizeType || '-',
        Number(row.micron || 0),
        Number(row.weight),
        Number(row.productionWeight || 0),
        Number(row.wastage || 0),
        Number(row.pcs),
        Number(row.bundle),
        row.status,
        new Date()
      ]);
    });
  }
}

function syncBilling(data) {
  var sheet = getSheet("Billing Data");
  if (!sheet) return;

  deleteRowsById(sheet, 0, data.challanNumber);

  if (data.type === 'BILL') {
    data.lines.forEach(function(line) {
      sheet.appendRow([
        "'" + data.challanNumber,
        data.date,
        data.partyName,
        line.size,
        line.sizeType || '-',
        Number(line.micron || 0),
        Number(line.weight),
        Number(line.rate),
        Number(line.amount),
        data.paymentMode,
        new Date()
      ]);
    });
  }
}

function syncSlitting(data) {
  var sheet = getSheet("Slitting Data");
  if (!sheet) return;

  deleteRowsById(sheet, 0, data.jobNo);

  if (data.type === 'SLITTING_JOB') {
    data.rows.forEach(function(row) {
      sheet.appendRow([
        "'" + data.jobNo,
        data.date,
        data.jobCode,
        Number(data.planQty),
        Number(data.planMicron),
        row.srNo,
        row.size,
        Number(row.grossWeight),
        Number(row.coreWeight),
        Number(row.netWeight),
        Number(row.meter),
        data.status,
        new Date()
      ]);
    });
  }
}

function syncPlanning(data) {
  var sheet = getSheet("Planning Data");
  if (!sheet) return;

  deleteRowsById(sheet, 0, data.id);

  if (data.type === 'PLAN') {
    sheet.appendRow([
      data.id,
      data.date,
      data.partyName,
      data.planType,
      data.size,
      data.printName || '',
      Number(data.micron),
      Number(data.weight),
      Number(data.meter),
      Number(data.cuttingSize || 0),
      Number(data.pcs),
      data.notes,
      data.status,
      new Date()
    ]);
  }
}

// --- UTILS ---

/* 
   Robust Row Deletion:
   Handles cases where IDs might be stored as "1001", "'1001", or 1001.
   Normalizes everything to string, trims whitespace, and removes leading apostrophes before comparing.
*/
function deleteRowsById(sheet, colIndex, id) {
  var idStr = String(id).trim().toLowerCase();
  
  var range = sheet.getDataRange();
  var values = range.getValues();
  
  // Loop backwards to safely delete rows without affecting indices of subsequent rows
  for (var i = values.length - 1; i >= 1; i--) { // Start from end, skip header (index 0)
    var cellVal = String(values[i][colIndex]).trim().toLowerCase();
    
    // Remove leading apostrophe if present (common Excel/Sheets text enforcement)
    if (cellVal.indexOf("'") === 0) {
      cellVal = cellVal.substring(1).trim();
    }
    
    if (cellVal === idStr) {
      sheet.deleteRow(i + 1); // deleteRow uses 1-based index
    }
  }
}

function getSheet(name, createIfMissing) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet && createIfMissing) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function setupHeaders() {
  var prod = getSheet("Production Data", true);
  if (prod.getLastRow() === 0) {
    prod.appendRow(["Job No", "Date", "Party Name", "Size", "Type", "Micron", "Dispatch Wt", "Prod Wt", "Wastage", "Pcs", "Bundle", "Status", "Timestamp"]);
    formatHeader(prod);
  }

  var bill = getSheet("Billing Data", true);
  if (bill.getLastRow() === 0) {
    bill.appendRow(["Challan No", "Date", "Party Name", "Item", "Type", "Micron", "Weight", "Rate", "Amount", "Mode", "Timestamp"]);
    formatHeader(bill);
  }

  var slit = getSheet("Slitting Data", true);
  if (slit.getLastRow() === 0) {
    slit.appendRow(["Job No", "Date", "Code", "Plan Qty", "Micron", "SR No", "Size", "Gross", "Core", "Net", "Meter", "Status", "Timestamp"]);
    formatHeader(slit);
  }

  var plan = getSheet("Planning Data", true);
  if (plan.getLastRow() === 0) {
    plan.appendRow(["Plan ID", "Date", "Party Name", "Type", "Size", "Print Name", "Micron", "Weight", "Meter", "Cut Size", "Pcs", "Notes", "Status", "Timestamp"]);
    formatHeader(plan);
  }
}

function formatHeader(sheet) {
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold").setBackground("#e2e8f0");
  sheet.setFrozenRows(1);
}

function doGet(e) {
  return ContentService.createTextOutput("RDMS Sync v1.2 Active");
}
`;
