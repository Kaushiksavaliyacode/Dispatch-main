
/* 
   ╔══════════════════════════════════════════════════════════════════╗
   ║  RDMS ULTRA PROFESSIONAL ANALYTICS DASHBOARD v5.2               ║
   ║  Enterprise-Grade Production, Billing & Slitting Intelligence    ║
   ╚══════════════════════════════════════════════════════════════════╝
   
   FIXES v5.2:
   • Simplified formula string construction to avoid syntax errors
   • Enhanced compatibility with Google Sheets parsing
*/

// ═══════════════════ MAIN POST HANDLER ═══════════════════
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);
    var response = { success: true, message: "" };

    // Dashboard Setup
    if (data.type === 'SETUP_DASHBOARD') {
      createUltraDashboard();
      response.message = "Dashboard created successfully";
      return ContentService.createTextOutput(JSON.stringify(response));
    }

    // Production Data Handler
    if (data.type === 'JOB' || data.type === 'DELETE_JOB') {
      handleProductionData(data);
      response.message = data.type === 'JOB' ? "Job saved" : "Job deleted";
    }

    // Billing Data Handler
    else if (data.type === 'BILL' || data.type === 'DELETE_BILL') {
      handleBillingData(data);
      response.message = data.type === 'BILL' ? "Bill saved" : "Bill deleted";
    }

    // Slitting Data Handler
    else if (data.type === 'SLITTING_JOB' || data.type === 'DELETE_SLITTING_JOB') {
      handleSlittingData(data);
      response.message = data.type === 'SLITTING_JOB' ? "Slitting job saved" : "Job deleted";
    }

    // Refresh Dashboard Metrics
    refreshDashboardMetrics();

    return ContentService.createTextOutput(JSON.stringify(response));
  } catch (err) { 
    return ContentService.createTextOutput(JSON.stringify({
      success: false, 
      error: err.toString()
    })); 
  } finally { 
    lock.releaseLock(); 
  }
}

// ═══════════════════ DATA HANDLERS ═══════════════════
function handleProductionData(data) {
  var tab = ensureSheet("Production Data", [
    "Job No", "Date", "Month", "Year", "Week", "Party", "Size", "Type", 
    "Micron", "Dispatch Wt", "Prod Wt", "Wastage", "Wastage %", 
    "Pcs", "Bundle", "Status", "Efficiency", "Timestamp"
  ]);
  
  deleteRow(tab, 0, data.dispatchNo);
  
  if (data.type === 'JOB') {
    var date = new Date(data.date);
    var month = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM");
    var year = date.getFullYear();
    var week = Utilities.formatDate(date, Session.getScriptTimeZone(), "w");
    
    data.rows.forEach(function(row) {
      var dispatchWt = Number(row.weight);
      var prodWt = Number(row.productionWeight || 0);
      var wastage = Number(row.wastage || 0);
      var wastagePercent = dispatchWt > 0 ? (wastage / dispatchWt * 100) : 0;
      var efficiency = dispatchWt > 0 ? (prodWt / dispatchWt * 100) : 0;
      
      tab.appendRow([
        "'" + data.dispatchNo,
        data.date,
        month,
        year,
        week,
        data.partyName,
        row.size,
        row.sizeType || '-',
        Number(row.micron || 0),
        dispatchWt,
        prodWt,
        wastage,
        wastagePercent,
        Number(row.pcs),
        Number(row.bundle),
        row.status,
        efficiency,
        new Date()
      ]);
    });
  }
}

function handleBillingData(data) {
  var tab = ensureSheet("Billing Data", [
    "Challan No", "Date", "Month", "Year", "Week", "Party", "Item", "Type", 
    "Micron", "Weight", "Rate", "Amount", "Cost", "Profit", "Margin %", 
    "Mode", "Status", "Due Date", "Age Days", "Timestamp"
  ]);
  
  deleteRow(tab, 0, data.challanNumber);
  
  if (data.type === 'BILL') {
    var date = new Date(data.date);
    var month = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM");
    var year = date.getFullYear();
    var week = Utilities.formatDate(date, Session.getScriptTimeZone(), "w");
    var dueDate = new Date(date.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days credit
    
    data.lines.forEach(function(line) {
      var amount = Number(line.amount);
      var weight = Number(line.weight);
      var cost = weight * 80; // Estimated cost per kg
      var profit = amount - cost;
      var margin = amount > 0 ? (profit / amount * 100) : 0;
      var ageDays = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
      
      tab.appendRow([
        "'" + data.challanNumber,
        data.date,
        month,
        year,
        week,
        data.partyName,
        line.size,
        line.sizeType || '-',
        Number(line.micron || 0),
        weight,
        Number(line.rate),
        amount,
        cost,
        profit,
        margin,
        data.paymentMode,
        data.paymentMode === 'UNPAID' ? 'PENDING' : 'PAID',
        dueDate,
        ageDays,
        new Date()
      ]);
    });
  }
}

function handleSlittingData(data) {
  var tab = ensureSheet("Slitting Data", [
    "Job No", "Date", "Month", "Year", "Week", "Job Code", "Plan Qty", 
    "Micron", "Status", "SR", "Size", "Gross", "Core", "Net", "Meter", 
    "Yield %", "Timestamp"
  ]);
  
  deleteRow(tab, 0, data.jobNo);
  
  if (data.type === 'SLITTING_JOB') {
    var date = new Date(data.date);
    var month = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM");
    var year = date.getFullYear();
    var week = Utilities.formatDate(date, Session.getScriptTimeZone(), "w");
    var planQty = Number(data.planQty);
    
    data.rows.forEach(function(row) {
      var netWeight = Number(row.netWeight);
      var yieldPercent = planQty > 0 ? (netWeight / planQty * 100) : 0;
      
      tab.appendRow([
        "'" + data.jobNo,
        data.date,
        month,
        year,
        week,
        data.jobCode,
        planQty,
        Number(data.planMicron),
        data.status,
        row.srNo,
        row.size,
        Number(row.grossWeight),
        Number(row.coreWeight),
        netWeight,
        Number(row.meter),
        yieldPercent,
        new Date()
      ]);
    });
  }
}

// ═══════════════════ DASHBOARD BUILDER ═══════════════════
function createUltraDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Initialize Data Sheets
  ensureSheet("Production Data", []);
  ensureSheet("Billing Data", []);
  ensureSheet("Slitting Data", []);
  
  // Create Helpers & Calculations
  createHelpersSheet(ss);
  createMetricsSheet(ss);
  
  // Build Main Dashboard
  var dash = ss.getSheetByName("🚀 EXECUTIVE DASHBOARD");
  if (dash) ss.deleteSheet(dash);
  dash = ss.insertSheet("🚀 EXECUTIVE DASHBOARD", 0);
  dash.setHiddenGridlines(true);
  
  // Column Widths
  dash.setColumnWidth(1, 15);  // Spacer
  dash.setColumnWidths(2, 14, 75); // Main columns
  dash.setColumnWidth(16, 15); // Right spacer
  
  buildDashboardHeader(dash);
  buildFilterSection(dash);
  buildKPISection(dash);
  buildChartsSection(dash);
  buildDataTables(dash);
  buildInsightsSection(dash);
  
  // Set Active Sheet
  ss.setActiveSheet(dash);
  ss.toast("✅ Dashboard created successfully!", "Success", 3);
}

// ═══════════════════ HELPERS SHEET ═══════════════════
function createHelpersSheet(ss) {
  var helpers = ss.getSheetByName("_Helpers");
  if (helpers) ss.deleteSheet(helpers);
  helpers = ss.insertSheet("_Helpers");
  helpers.hideSheet();
  
  // Parties Dropdown
  helpers.getRange("A1").setValue("All Parties");
  helpers.getRange("A2").setFormula("=SORT(UNIQUE(FILTER({'Production Data'!F:F;'Billing Data'!F:F}, {'Production Data'!F:F;'Billing Data'!F:F}<>'Party', {'Production Data'!F:F;'Billing Data'!F:F}<>'')))");
  
  // Months Dropdown
  helpers.getRange("B1").setValue("All Months");
  helpers.getRange("B2").setFormula("=SORT(UNIQUE(FILTER({'Production Data'!C:C;'Billing Data'!C:C}, {'Production Data'!C:C;'Billing Data'!C:C}<>'Month', {'Production Data'!C:C;'Billing Data'!C:C}<>'')), 1, FALSE)");
  
  // Status Dropdown
  helpers.getRange("C1").setValue("All Status");
  helpers.getRange("C2:C5").setValues([["COMPLETED"], ["PENDING"], ["SLITTING"], ["IN PROGRESS"]]);
  
  // Type Dropdown
  helpers.getRange("D1").setValue("All Types");
  helpers.getRange("D2").setFormula("=SORT(UNIQUE(FILTER({'Production Data'!H:H;'Billing Data'!H:H}, {'Production Data'!H:H;'Billing Data'!H:H}<>'Type', {'Production Data'!H:H;'Billing Data'!H:H}<>'')))");
}

// ═══════════════════ METRICS CALCULATION SHEET ═══════════════════
function createMetricsSheet(ss) {
  var metrics = ss.getSheetByName("_Metrics");
  if (metrics) ss.deleteSheet(metrics);
  metrics = ss.insertSheet("_Metrics");
  metrics.hideSheet();
  
  // Store calculated metrics for dashboard reference
  metrics.getRange("A1:B20").setValues([
    ["Metric", "Value"],
    ["Total Revenue", "=SUM('Billing Data'!L:L)"],
    ["Total Production", "=SUM('Production Data'!K:K)"],
    ["Total Wastage", "=SUM('Production Data'!L:L)"],
    ["Avg Efficiency", "=AVERAGE('Production Data'!Q:Q)"],
    ["Total Jobs", "=COUNTA(UNIQUE('Production Data'!A:A))-1"],
    ["Total Bills", "=COUNTA(UNIQUE('Billing Data'!A:A))-1"],
    ["Outstanding Amount", "=SUMIF('Billing Data'!Q:Q, 'PENDING', 'Billing Data'!L:L)"],
    ["Paid Amount", "=SUMIF('Billing Data'!Q:Q, 'PAID', 'Billing Data'!L:L)"],
    ["Avg Profit Margin", "=AVERAGE('Billing Data'!O:O)"],
    ["Total Profit", "=SUM('Billing Data'!N:N)"],
    ["Active Parties", "=COUNTA(UNIQUE('Production Data'!F:F))-1"],
    ["Slitting Jobs", "=COUNTA(UNIQUE('Slitting Data'!A:A))-1"],
    ["Avg Wastage %", "=AVERAGE('Production Data'!M:M)"],
    ["Revenue Growth", "=0"], // Placeholder for trend calculation
    ["Production Growth", "=0"],
    ["Efficiency Trend", "=0"],
    ["Credit Utilization %", "=A8/(A8+A9)*100"],
    ["Overdue Amount", "=SUMIF('Billing Data'!S:S, '>30', 'Billing Data'!L:L)"],
    ["This Month Revenue", "=SUMIFS('Billing Data'!L:L, 'Billing Data'!C:C, TEXT(TODAY(), 'yyyy-MM'))"]
  ]);
}

// ═══════════════════ DASHBOARD SECTIONS ═══════════════════
function buildDashboardHeader(dash) {
  var header = dash.getRange("B2:O4");
  header.merge()
    .setValue("RDMS EXECUTIVE ANALYTICS DASHBOARD")
    .setBackground("#0f172a")
    .setFontColor("#f1f5f9")
    .setFontSize(26)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  dash.getRange("B5:O5").merge()
    .setValue("Real-Time Production Intelligence & Business Insights")
    .setBackground("#1e293b")
    .setFontColor("#94a3b8")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setFontStyle("italic");
  
  dash.getRange("B6:O6").merge()
    .setFormula('="Last Updated: " & TEXT(NOW(), "DD-MMM-YYYY hh:mm AM/PM")')
    .setBackground("#1e293b")
    .setFontColor("#64748b")
    .setFontSize(9)
    .setHorizontalAlignment("center");
}

function buildFilterSection(dash) {
  var row = 8;
  
  dash.getRange(row, 2, 1, 14).merge()
    .setValue("📊 DYNAMIC FILTERS")
    .setBackground("#3b82f6")
    .setFontColor("white")
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("center");
  
  row += 1;
  
  dash.getRange(row, 2).setValue("Party:").setFontWeight("bold").setFontColor("#475569");
  var partyRule = SpreadsheetApp.newDataValidation().requireValueInRange(dash.getRange("_Helpers!A1:A200")).build();
  dash.getRange(row, 3, 1, 3).merge()
    .setDataValidation(partyRule)
    .setValue("All Parties")
    .setBackground("#f8fafc")
    .setBorder(true, true, true, true, true, true, "#cbd5e1", null)
    .setHorizontalAlignment("center")
    .setFontWeight("bold");
  
  dash.getRange(row, 7).setValue("Month:").setFontWeight("bold").setFontColor("#475569");
  var monthRule = SpreadsheetApp.newDataValidation().requireValueInRange(dash.getRange("_Helpers!B1:B100")).build();
  dash.getRange(row, 8, 1, 3).merge()
    .setDataValidation(monthRule)
    .setValue("All Months")
    .setBackground("#f8fafc")
    .setBorder(true, true, true, true, true, true, "#cbd5e1", null)
    .setHorizontalAlignment("center")
    .setFontWeight("bold");
  
  dash.getRange(row, 12).setValue("Status:").setFontWeight("bold").setFontColor("#475569");
  var statusRule = SpreadsheetApp.newDataValidation().requireValueInRange(dash.getRange("_Helpers!C1:C10")).build();
  dash.getRange(row, 13, 1, 3).merge()
    .setDataValidation(statusRule)
    .setValue("All Status")
    .setBackground("#f8fafc")
    .setBorder(true, true, true, true, true, true, "#cbd5e1", null)
    .setHorizontalAlignment("center")
    .setFontWeight("bold");
}

function buildKPISection(dash) {
  var row = 11;

  dash.getRange(row, 2, 1, 14).merge()
    .setValue("🎯 KEY PERFORMANCE INDICATORS")
    .setBackground("#10b981")
    .setFontColor("white")
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("center");

  row++;

  createAdvancedKPI(
    dash, row, 2, "TOTAL REVENUE", "#10b981",
    '=SUMIFS(\'Billing Data\'!L:L, \'Billing Data\'!F:F, IF(C9="All Parties","*",C9), \'Billing Data\'!C:C, IF(H9="All Months","*",H9))',
    '₹#,##0',
    '=SPARKLINE(QUERY(\'Billing Data\'!C:L, "SELECT C, SUM(L) WHERE C IS NOT NULL GROUP BY C ORDER BY C", 0), {"charttype","line";"color","#10b981";"linewidth",2})'
  );

  createAdvancedKPI(
    dash, row, 6, "PRODUCTION OUTPUT", "#3b82f6",
    '=SUMIFS(\'Production Data\'!K:K, \'Production Data\'!F:F, IF(C9="All Parties","*",C9), \'Production Data\'!C:C, IF(H9="All Months","*",H9))',
    '#,##0.0" kg"',
    '=SPARKLINE(QUERY(\'Production Data\'!C:K, "SELECT C, SUM(K) WHERE C IS NOT NULL GROUP BY C ORDER BY C", 0), {"charttype","area";"color","#3b82f6";"fillcolor","#dbeafe"})'
  );

  createAdvancedKPI(
    dash, row, 10, "TOTAL PROFIT", "#8b5cf6",
    '=SUMIFS(\'Billing Data\'!N:N, \'Billing Data\'!F:F, IF(C9="All Parties","*",C9), \'Billing Data\'!C:C, IF(H9="All Months","*",H9))',
    '₹#,##0',
    '=SPARKLINE(QUERY(\'Billing Data\'!C:N, "SELECT C, SUM(N) WHERE C IS NOT NULL GROUP BY C ORDER BY C", 0), {"charttype","column";"color","#8b5cf6"})'
  );

  createAdvancedKPI(
    dash, row, 14, "AVG EFFICIENCY", "#f59e0b",
    '=AVERAGE(FILTER(\'Production Data\'!Q:Q, \'Production Data\'!F:F=IF(C9="All Parties",\'Production Data\'!F:F,C9), \'Production Data\'!C:C=IF(H9="All Months",\'Production Data\'!C:C,H9)))',
    '#0.0"%"',
    '=SPARKLINE({1}, {"charttype","bar";"color1","#f59e0b";"max",100})'
  );

  row += 6;

  createAdvancedKPI(
    dash, row, 2, "UNPAID CREDIT", "#ef4444",
    '=SUMIFS(\'Billing Data\'!L:L, \'Billing Data\'!Q:Q, "PENDING", \'Billing Data\'!F:F, IF(C9="All Parties","*",C9))',
    '₹#,##0',
    '=SPARKLINE(QUERY(\'Billing Data\'!F:L, "SELECT F, SUM(L) WHERE Q=\'PENDING\' GROUP BY F ORDER BY SUM(L) DESC LIMIT 5", 0), {"charttype","bar";"color1","#ef4444"})'
  );

  createAdvancedKPI(
    dash, row, 6, "TOTAL WASTAGE", "#f97316",
    '=SUMIFS(\'Production Data\'!L:L, \'Production Data\'!F:F, IF(C9="All Parties","*",C9), \'Production Data\'!C:C, IF(H9="All Months","*",H9))',
    '#,##0.0" kg"',
    '=SPARKLINE(QUERY(\'Production Data\'!C:M, "SELECT C, AVG(M) WHERE C IS NOT NULL GROUP BY C ORDER BY C", 0), {"charttype","line";"color","#f97316";"linewidth",2})'
  );

  createAdvancedKPI(
    dash, row, 10, "ACTIVE JOBS", "#06b6d4",
    '=COUNTIFS(\'Production Data\'!P:P, "PENDING", \'Production Data\'!F:F, IF(C9="All Parties","*",C9))',
    '#,##0" Jobs"',
    '=SPARKLINE(QUERY(\'Production Data\'!P:P, "SELECT P, COUNT(P) WHERE P<>\'\' GROUP BY P", 0), {"charttype","pie"})'
  );

  createAdvancedKPI(
    dash, row, 14, "PROFIT MARGIN", "#14b8a6",
    '=AVERAGE(FILTER(\'Billing Data\'!O:O, \'Billing Data\'!F:F=IF(C9="All Parties",\'Billing Data\'!F:F,C9), \'Billing Data\'!C:C=IF(H9="All Months",\'Billing Data\'!C:C,H9)))',
    '#0.0"%"',
    '=SPARKLINE({1}, {"charttype","bar";"color1","#14b8a6";"max",50})'
  );
}

function buildChartsSection(dash) {
  var row = 25;

  dash.getRange(row, 2, 1, 14).merge()
    .setValue("📈 ANALYTICS & INSIGHTS")
    .setBackground("#6366f1")
    .setFontColor("white")
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("center");

  row++;

  dash.getRange(row, 2).setValue("Top 10 Parties (Revenue)").setFontWeight("bold").setFontColor("#1e293b");
  dash.getRange(row + 1, 2).setFormula(
    '=SPARKLINE(QUERY(\'Billing Data\'!F:L, "SELECT F, SUM(L) WHERE F IS NOT NULL GROUP BY F ORDER BY SUM(L) DESC LIMIT 10", 0), {"charttype","column";"color","#10b981"})'
  );
  dash.getRange(row + 1, 2, 1, 6).merge().setHeight(150);

  dash.getRange(row, 9).setValue("Monthly Revenue Trend").setFontWeight("bold").setFontColor("#1e293b");
  dash.getRange(row + 1, 9).setFormula(
    '=SPARKLINE(QUERY(\'Billing Data\'!C:L, "SELECT C, SUM(L) WHERE C IS NOT NULL GROUP BY C ORDER BY C", 0), {"charttype","line";"color","#3b82f6";"linewidth",3})'
  );
  dash.getRange(row + 1, 9, 1, 7).merge().setHeight(150);
}

function buildDataTables(dash) {
  var row = 35;

  dash.getRange(row, 2, 1, 7).merge()
    .setValue("📋 RECENT PRODUCTION LOGS")
    .setBackground("#f1f5f9")
    .setFontWeight("bold")
    .setFontColor("#334155")
    .setFontSize(11);

  dash.getRange(row + 1, 2).setFormula(
    '=QUERY(\'Production Data\'!A:Q,' +
    '"SELECT A, B, F, G, J, K, L, M, P ' +
    'WHERE F LIKE \'%" & IF(C9="All Parties","",C9) & "%\' ' +
    'AND C LIKE \'%" & IF(H9="All Months","",H9) & "%\' ' +
    'AND P LIKE \'%" & IF(M9="All Status","",M9) & "%\' ' +
    'ORDER BY B DESC LIMIT 12",' +
    '1)'
  );
  styleDataTable(dash, row + 1, 2, 13, 9);

  dash.getRange(row, 10, 1, 6).merge()
    .setValue("💰 PENDING PAYMENTS (AGING ANALYSIS)")
    .setBackground("#fef2f2")
    .setFontWeight("bold")
    .setFontColor("#991b1b")
    .setFontSize(11);

  dash.getRange(row + 1, 10).setFormula(
    '=QUERY(\'Billing Data\'!A:S,' +
    '"SELECT A, B, F, L, S ' +
    'WHERE Q=\'PENDING\' ' +
    'AND F LIKE \'%" & IF(C9="All Parties","",C9) & "%\' ' +
    'ORDER BY S DESC LIMIT 12",' +
    '1)'
  );
  styleDataTable(dash, row + 1, 10, 13, 6);

  row += 15;

  dash.getRange(row, 2, 1, 14).merge()
    .setValue("🏭 SLITTING FLOOR LIVE STATUS")
    .setBackground("#fffbeb")
    .setFontWeight("bold")
    .setFontColor("#92400e")
    .setFontSize(11);

  dash.getRange(row + 1, 2).setFormula(
    '=QUERY(\'Slitting Data\'!A:P,' +
    '"SELECT A, B, F, L, N, O, P, I ' +
    'WHERE A IS NOT NULL ORDER BY B DESC LIMIT 10",' +
    '1)'
  );
  styleDataTable(dash, row + 1, 2, 11, 14);
}


function buildInsightsSection(dash) {
  var row = 62;
  
  dash.getRange(row, 2, 1, 6).merge()
    .setValue("🔍 QUICK SEARCH TOOL")
    .setBackground("#e0e7ff")
    .setFontWeight("bold")
    .setFontColor("#3730a3")
    .setFontSize(11);
  
  dash.getRange(row+1, 2).setValue("Enter Job/Challan No:");
  dash.getRange(row+1, 4, 1, 4).merge()
    .setBackground("#ffffff")
    .setBorder(true, true, true, true, true, true, "#6366f1", null);
  
  // FIX: Explicit string handling to avoid syntax error
  var cellD = "D" + (row + 1);
  // Construction: QUERY(Sheet, "SELECT * WHERE A = '" & D63 & "'", 1)
  var qProd = "QUERY('Production Data'!A:Q, \"SELECT * WHERE A = '\" & " + cellD + " & \"'\", 1)";
  var qBill = "QUERY('Billing Data'!A:S, \"SELECT * WHERE A = '\" & " + cellD + " & \"'\", 1)";
  
  dash.getRange(row+2, 2).setFormula(
    "=IF(" + cellD + "=\"\", \"Enter number to search\", IFERROR(" + qProd + ", IFERROR(" + qBill + ", \"No data found\")))"
  );
  
  dash.getRange(row, 9, 1, 7).merge()
    .setValue("⚠️ PERFORMANCE ALERTS")
    .setBackground("#fef3c7")
    .setFontWeight("bold")
    .setFontColor("#92400e")
    .setFontSize(11);
  
  dash.getRange(row+1, 9).setFormula(
    "=IF(COUNTIFS('Billing Data'!S:S, '>45')>0, '• '&COUNTIFS('Billing Data'!S:S, '>45')&' bills overdue >45 days', '') & CHAR(10) & IF(AVERAGE('Production Data'!M:M)>5, '• High wastage alert: '&TEXT(AVERAGE('Production Data'!M:M), '0.0')&'%', '') & CHAR(10) & IF(COUNTIF('Production Data'!P:P, 'PENDING')>10, '• '&COUNTIF('Production Data'!P:P, 'PENDING')&' pending jobs', '')"
  );
  dash.getRange(row+1, 9, 3, 7).merge()
    .setWrap(true)
    .setVerticalAlignment("top")
    .setFontColor("#92400e")
    .setFontSize(10);
}

// ═══════════════════ HELPER FUNCTIONS ═══════════════════
function createAdvancedKPI(sheet, row, col, title, color, valueFormula, format, chartFormula) {
  var cardRange = sheet.getRange(row, col, 5, 4);
  cardRange.setBackground("#ffffff")
    .setBorder(true, true, true, true, false, false, color, SpreadsheetApp.BorderStyle.SOLID_THICK);
  
  sheet.getRange(row, col, 1, 4).merge()
    .setValue(title)
    .setFontColor("#64748b")
    .setFontSize(9)
    .setFontWeight("bold")
    .setVerticalAlignment("top")
    .setHorizontalAlignment("left")
    .setBackground("#f8fafc");
  
  sheet.getRange(row + 1, col, 1, 4).merge()
    .setFormula(valueFormula)
    .setNumberFormat(format)
    .setFontSize(20)
    .setFontWeight("bold")
    .setFontColor("#1e293b")
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");
  
  sheet.getRange(row + 3, col, 2, 4).merge()
    .setFormula(chartFormula);
}

function styleDataTable(sheet, startRow, startCol, numRows, numCols) {
  var range = sheet.getRange(startRow, startCol, numRows, numCols);
  range.setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  
  var header = sheet.getRange(startRow, startCol, 1, numCols);
  header.setBackground("#f1f5f9")
    .setFontWeight("bold")
    .setFontColor("#334155")
    .setFontSize(9)
    .setHorizontalAlignment("center");
  
  var dataRows = sheet.getRange(startRow + 1, startCol, numRows - 1, numCols);
  dataRows.setFontSize(9)
    .setVerticalAlignment("middle")
    .setWrap(false);
  
  for (var i = 1; i < numRows; i++) {
    if (i % 2 === 0) {
      sheet.getRange(startRow + i, startCol, 1, numCols).setBackground("#fafafa");
    }
  }
  
  var statusCol = sheet.getRange(startRow + 1, startCol + numCols - 1, numRows - 1, 1);
  var rules = sheet.getConditionalFormatRules();
  
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("COMPLETED")
    .setBackground("#dcfce7")
    .setFontColor("#166534")
    .setRanges([statusCol])
    .build());
  
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("PENDING")
    .setBackground("#fef3c7")
    .setFontColor("#92400e")
    .setRanges([statusCol])
    .build());
  
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("PAID")
    .setBackground("#dcfce7")
    .setFontColor("#166534")
    .setRanges([statusCol])
    .build());
  
  sheet.setConditionalFormatRules(rules);
}

function ensureSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground("#1e293b")
        .setFontColor("#ffffff")
        .setFontWeight("bold")
        .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function deleteRow(sheet, colIndex, value) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIndex]).replace(/'/g, '') == String(value).replace(/'/g, '')) {
      sheet.deleteRow(i + 1);
    }
  }
}

function refreshDashboardMetrics() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dash = ss.getSheetByName("🚀 EXECUTIVE DASHBOARD");
  if (dash) {
    dash.getRange("B6:O6").setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy hh:mm a"));
    SpreadsheetApp.flush();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("RDMS API Active");
}
