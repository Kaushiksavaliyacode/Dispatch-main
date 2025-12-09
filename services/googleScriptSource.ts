export const GOOGLE_SCRIPT_CODE = `
/* 
   RDMS ULTRA PROFESSIONAL DASHBOARD SCRIPT 
   v4.0 - Production, Billing & Slitting Analytics
   
   INSTRUCTIONS:
   1. Paste this code into Extensions > Apps Script in your Google Sheet.
   2. Save and Deploy as Web App (Execute as: Me, Who has access: Anyone).
   3. Copy the Deployment URL and paste it into your React App's configuration.
*/

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);

    // --- TRIGGER DASHBOARD REBUILD ---
    if (data.type === 'SETUP_DASHBOARD') {
      createUltraDashboard();
      return ContentService.createTextOutput("Dashboard Created");
    }

    // --- 1. PRODUCTION DATA (DISPATCH) ---
    if (data.type === 'JOB' || data.type === 'DELETE_JOB') {
      var tab = ensureSheet("Production Data", ["Job No", "Date", "Month", "Party", "Size", "Type", "Micron", "Dispatch Wt", "Prod Wt", "Wastage", "Pcs", "Bundle", "Status"]);
      deleteRow(tab, 0, data.dispatchNo); // Delete existing based on Job No (Col A)
      
      if (data.type === 'JOB') {
        var month = Utilities.formatDate(new Date(data.date), Session.getScriptTimeZone(), "yyyy-MM");
        data.rows.forEach(function(row) {
          tab.appendRow([
            "'" + data.dispatchNo, // Force string to prevent formatting issues
            data.date, 
            month, 
            data.partyName, 
            row.size, 
            row.sizeType || '-', 
            row.micron || 0, 
            Number(row.weight), 
            Number(row.productionWeight || 0), 
            Number(row.wastage || 0), 
            Number(row.pcs), 
            Number(row.bundle), 
            row.status
          ]);
        });
      }
    }

    // --- 2. BILLING DATA (CHALLAN) ---
    else if (data.type === 'BILL' || data.type === 'DELETE_BILL') {
      var tab = ensureSheet("Billing Data", ["Challan No", "Date", "Month", "Party", "Item", "Type", "Micron", "Weight", "Rate", "Amount", "Mode"]);
      deleteRow(tab, 0, data.challanNumber);
      
      if (data.type === 'BILL') {
        var month = Utilities.formatDate(new Date(data.date), Session.getScriptTimeZone(), "yyyy-MM");
        data.lines.forEach(function(line) {
          tab.appendRow([
            "'" + data.challanNumber, 
            data.date, 
            month, 
            data.partyName, 
            line.size, 
            line.sizeType || '-', 
            line.micron || 0, 
            Number(line.weight), 
            Number(line.rate), 
            Number(line.amount), 
            data.paymentMode
          ]);
        });
      }
    }

    // --- 3. SLITTING DATA ---
    else if (data.type === 'SLITTING_JOB' || data.type === 'DELETE_SLITTING_JOB') {
        var tab = ensureSheet("Slitting Data", ["Job No", "Date", "Month", "Job Code", "Plan Qty", "Micron", "Status", "SR", "Size", "Gross", "Core", "Net", "Meter"]);
        deleteRow(tab, 0, data.jobNo); 

        if (data.type === 'SLITTING_JOB') {
            var month = Utilities.formatDate(new Date(data.date), Session.getScriptTimeZone(), "yyyy-MM");
            data.rows.forEach(function(row) {
                tab.appendRow([
                    "'" + data.jobNo, 
                    data.date, 
                    month,
                    data.jobCode, 
                    Number(data.planQty), 
                    Number(data.planMicron), 
                    data.status,
                    row.srNo, 
                    row.size, 
                    Number(row.grossWeight), 
                    Number(row.coreWeight), 
                    Number(row.netWeight), 
                    Number(row.meter)
                ]);
            });
        }
    }

    return ContentService.createTextOutput("Success");
  } catch (err) { 
    return ContentService.createTextOutput("Error: " + err.toString()); 
  } finally { 
    lock.releaseLock(); 
  }
}

// --- DASHBOARD GENERATOR ---
function createUltraDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Helpers Sheet (Dropdown Sources)
  var helpers = ss.getSheetByName("Helpers");
  if (helpers) ss.deleteSheet(helpers);
  helpers = ss.insertSheet("Helpers");
  helpers.hideSheet();
  
  // Extract Unique Parties & Months for Dropdowns
  helpers.getRange("A1").setFormula("=UNIQUE({'Production Data'!D:D; 'Billing Data'!D:D})"); // Parties
  helpers.getRange("B1").setValue("All Parties");
  helpers.getRange("B2").setFormula("=SORT(FILTER(A:A, A:A<>'Party', A:A<>''))"); 
  
  helpers.getRange("C1").setFormula("=UNIQUE({'Production Data'!C:C; 'Billing Data'!C:C})"); // Months
  helpers.getRange("D1").setValue("All Months");
  helpers.getRange("D2").setFormula("=SORT(FILTER(C:C, C:C<>'Month', C:C<>''), 1, FALSE)");

  // 2. CREATE DASHBOARD SHEET
  var dash = ss.getSheetByName("🚀 DASHBOARD");
  if (dash) ss.deleteSheet(dash);
  dash = ss.insertSheet("🚀 DASHBOARD", 0);
  dash.setHiddenGridlines(true);
  dash.setColumnWidth(1, 10); // Spacer Col A

  // --- HEADER ---
  var header = dash.getRange("B2:M3");
  header.merge().setValue("RDMS EXECUTIVE INSIGHTS")
      .setBackground("#1e293b").setFontColor("white")
      .setFontSize(20).setFontWeight("bold")
      .setHorizontalAlignment("center").setVerticalAlignment("middle");

  // --- FILTERS ---
  dash.getRange("B5").setValue("FILTER PARTY:").setFontWeight("bold").setFontColor("#64748b");
  var ruleParty = SpreadsheetApp.newDataValidation().requireValueInRange(helpers.getRange("B1:B200")).build();
  dash.getRange("C5:E5").merge().setDataValidation(ruleParty).setValue("All Parties")
      .setBackground("#f8fafc").setBorder(true, true, true, true, true, true, "#cbd5e1", null).setFontWeight("bold");

  dash.getRange("G5").setValue("FILTER MONTH:").setFontWeight("bold").setFontColor("#64748b");
  var ruleMonth = SpreadsheetApp.newDataValidation().requireValueInRange(helpers.getRange("D1:D50")).build();
  dash.getRange("H5:J5").merge().setDataValidation(ruleMonth).setValue("All Months")
      .setBackground("#f8fafc").setBorder(true, true, true, true, true, true, "#cbd5e1", null).setFontWeight("bold");
  
  // ===================== KPI CARDS =====================

  // REVENUE
  createKpiCard(dash, "B7:E11", "TOTAL REVENUE", "#10b981", 
    \`=SUMIFS('Billing Data'!J:J, 'Billing Data'!D:D, IF(C5="All Parties", "*", C5), 'Billing Data'!C:C, IF(H5="All Months", "*", H5))\`, 
    "₹#,##0", 
    // Sparkline: Revenue Trend
    \`=SPARKLINE(QUERY('Billing Data'!A:K, "SELECT SUM(J) WHERE " & IF(C5="All Parties", "D IS NOT NULL", "D='"&C5&"'") & " GROUP BY C PIVOT 'x'"), {"charttype","column"; "color","#10b981"})\`);

  // PRODUCTION
  createKpiCard(dash, "G7:J11", "PRODUCTION OUTPUT", "#3b82f6", 
    \`=SUMIFS('Production Data'!I:I, 'Production Data'!D:D, IF(C5="All Parties", "*", C5), 'Production Data'!C:C, IF(H5="All Months", "*", H5))\`, 
    "#,##0.0 kg",
    // Sparkline: Production Trend
    \`=SPARKLINE(QUERY('Production Data'!A:M, "SELECT SUM(I) WHERE " & IF(C5="All Parties", "D IS NOT NULL", "D='"&C5&"'") & " GROUP BY C PIVOT 'x'"), {"charttype","area"; "color","#3b82f6"; "fillcolor","#dbeafe"})\`);

  // OUTSTANDING
  createKpiCard(dash, "L7:O11", "UNPAID CREDIT", "#ef4444", 
    \`=SUMIFS('Billing Data'!J:J, 'Billing Data'!K:K, "UNPAID", 'Billing Data'!D:D, IF(C5="All Parties", "*", C5))\`, 
    "₹#,##0",
    // Sparkline: Bar for Credit Load
    \`=SPARKLINE({1}, {"charttype","bar"; "color1","#ef4444"; "max",1})\`);


  // ===================== TABLES =====================
  
  // 1. RECENT JOBS
  dash.getRange("B14").setValue("RECENT PRODUCTION LOGS").setFontWeight("bold").setFontColor("#334155");
  var qJobs = \`=QUERY('Production Data'!A:M, "SELECT A, B, D, E, H, I, J, M WHERE D LIKE '" & IF(C5="All Parties", "%", C5) & "' AND C LIKE '" & IF(H5="All Months", "%", H5) & "' ORDER BY B DESC LIMIT 15 LABEL A 'Job No', B 'Date', D 'Party', E 'Size', H 'Disp Wt', I 'Prod Wt', J 'Waste', M 'Status'", 1)\`;
  dash.getRange("B15").setFormula(qJobs);
  styleTable(dash, "B15:I31", "#f1f5f9");

  // Conditional Formatting: Status
  var rangeStatus = dash.getRange("I16:I31");
  var rules = dash.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("COMPLETED").setBackground("#dcfce7").setFontColor("#166534").setRanges([rangeStatus]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("PENDING").setBackground("#f1f5f9").setFontColor("#64748b").setRanges([rangeStatus]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("SLITTING").setBackground("#fef3c7").setFontColor("#92400e").setRanges([rangeStatus]).build());
  dash.setConditionalFormatRules(rules);


  // 2. UNPAID BILLS
  dash.getRange("K14").setValue("PENDING PAYMENTS").setFontWeight("bold").setFontColor("#334155");
  var qBills = \`=QUERY('Billing Data'!A:K, "SELECT A, B, D, J WHERE K = 'UNPAID' AND D LIKE '" & IF(C5="All Parties", "%", C5) & "' ORDER BY B DESC LIMIT 15 LABEL A 'Challan', B 'Date', D 'Party', J 'Amount'", 1)\`;
  dash.getRange("K15").setFormula(qBills);
  styleTable(dash, "K15:N31", "#fef2f2");

  
  // 3. SLITTING SUMMARY
  dash.getRange("B34").setValue("SLITTING FLOOR LIVE STATUS").setFontWeight("bold").setFontColor("#334155");
  var qSlit = \`=QUERY('Slitting Data'!A:M, "SELECT A, B, C, I, K, M, G WHERE A IS NOT NULL ORDER BY B DESC LIMIT 10 LABEL A 'Job No', B 'Date', C 'Job Code', I 'Gross', K 'Net Wt', M 'Meter', G 'Status'", 1)\`;
  dash.getRange("B35").setFormula(qSlit);
  styleTable(dash, "B35:H46", "#fffbeb");


  // 4. LOOKUP TOOLS
  dash.getRange("K34").setValue("QUICK SEARCH").setFontWeight("bold").setFontColor("#334155");
  dash.getRange("K35").setValue("Enter Job/Bill No:").setFontSize(8);
  dash.getRange("L35:M35").merge().setBackground("#fff").setBorder(true,true,true,true,true,true,"#cbd5e1",null);
  
  dash.getRange("K37").setFormula(\`=IF(L35="", "Enter number above", IFERROR(QUERY('Production Data'!A:M, "SELECT * WHERE A = '"&L35&"'",1), "Checking Bills..."))\`);
  dash.getRange("K40").setFormula(\`=IF(L35="", "", IFERROR(QUERY('Billing Data'!A:K, "SELECT * WHERE A = '"&L35&"'",1), "No Data Found"))\`);
}

function createKpiCard(sheet, rangeStr, title, color, valFormula, format, chartFormula) {
  var r = sheet.getRange(rangeStr);
  r.merge().setBackground("white").setBorder(true, true, true, true, true, true, color, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  var row = r.getRow(), col = r.getColumn();
  
  sheet.getRange(row, col).setValue(title).setFontColor("#94a3b8").setFontSize(8).setFontWeight("bold").setVerticalAlignment("top").setHorizontalAlignment("left");
  sheet.getRange(row+1, col).setFormula(valFormula).setNumberFormat(format).setFontSize(22).setFontWeight("bold").setFontColor("#1e293b").setHorizontalAlignment("left");
  sheet.getRange(row+3, col).setFormula(chartFormula).mergeAcross(2).setHeight(50);
}

function styleTable(sheet, rangeStr, headerBg) {
  var r = sheet.getRange(rangeStr);
  r.setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  var header = sheet.getRange(r.getRow(), r.getColumn(), 1, r.getNumColumns());
  header.setBackground(headerBg).setFontWeight("bold").setFontColor("#475569").setFontSize(9);
  
  // Body
  var body = sheet.getRange(r.getRow()+1, r.getColumn(), r.getNumRows()-1, r.getNumColumns());
  body.setFontSize(9).setVerticalAlignment("middle");
}

function ensureSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function deleteRow(sheet, colIndex, value) {
  var data = sheet.getDataRange().getValues();
  // Loop backwards to delete without messing up indices
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIndex]) == String(value)) {
      sheet.deleteRow(i + 1);
    }
  }
}
`;