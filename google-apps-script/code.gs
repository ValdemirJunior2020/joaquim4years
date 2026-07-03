const SPREADSHEET_ID = '1QCzTuCMLM9FiKAVOKwGEI9sR7CwrtXWAiZpDgPEDR8U';
const RSVP_SHEET_NAME = 'RSVPs';

const HEADERS = [
  'Timestamp',
  'Type',
  'Guest Name',
  'Attendance',
  'Guest Count',
  'Child Name',
  'Message',
  'Dietary Notes',
  'Reaction',
  'User Agent',
];

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'test';

    if (action === 'messages') {
      const limit = Math.min(Number(params.limit || 12), 50);
      return jsonOutput({
        ok: true,
        messages: getRecentMessages(limit),
      });
    }

    const sheet = getOrCreateSheet_();
    return jsonOutput({
      ok: true,
      message: 'Joaquim birthday RSVP endpoint is live.',
      sheetName: sheet.getName(),
      expectedColumns: HEADERS,
    });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);
    const payload = parsePayload_(e);
    const normalized = normalizePayload_(payload);
    validatePayload_(normalized);

    const sheet = getOrCreateSheet_();
    sheet.appendRow([
      new Date(),
      normalized.type,
      normalized.guestName,
      normalized.attendance,
      normalized.guestCount,
      normalized.childName,
      normalized.message,
      normalized.dietaryNotes,
      normalized.reaction,
      normalized.userAgent,
    ]);

    return jsonOutput({
      ok: true,
      message: 'Saved successfully.',
      saved: {
        type: normalized.type,
        guestName: normalized.guestName,
        attendance: normalized.attendance,
      },
    });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // Lock may not exist if waitLock failed. No action needed.
    }
  }
}

function parsePayload_(e) {
  if (!e) return {};

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      throw new Error('Invalid JSON payload.');
    }
  }

  return e.parameter || {};
}

function normalizePayload_(payload) {
  return {
    type: clean_(payload.type || 'rsvp').toLowerCase(),
    guestName: clean_(payload.guestName),
    attendance: clean_(payload.attendance),
    guestCount: payload.guestCount === '' || payload.guestCount === undefined ? '' : Number(payload.guestCount),
    childName: clean_(payload.childName),
    message: clean_(payload.message),
    dietaryNotes: clean_(payload.dietaryNotes),
    reaction: clean_(payload.reaction),
    userAgent: clean_(payload.userAgent),
  };
}

function validatePayload_(payload) {
  const allowedTypes = ['rsvp', 'message', 'reaction'];
  if (!allowedTypes.includes(payload.type)) {
    throw new Error('Invalid action type. Use rsvp, message, or reaction.');
  }

  if (payload.type === 'rsvp') {
    if (!payload.guestName) throw new Error('Guest name is required.');
    if (!['Yes', 'No', 'Maybe'].includes(payload.attendance)) {
      throw new Error('Attendance must be Yes, No, or Maybe.');
    }
    if (!Number.isInteger(payload.guestCount) || payload.guestCount < 1 || payload.guestCount > 25) {
      throw new Error('Guest count must be a whole number from 1 to 25.');
    }
  }

  if (payload.type === 'message') {
    if (!payload.guestName) throw new Error('Guest name is required for messages.');
    if (!payload.message) throw new Error('Message is required.');
  }

  if (payload.type === 'reaction') {
    if (!payload.reaction) throw new Error('Reaction is required.');
  }

  if (payload.message && payload.message.length > 220) {
    throw new Error('Message must be 220 characters or fewer.');
  }
}

function getOrCreateSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(RSVP_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(RSVP_SHEET_NAME);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }

  return sheet;
}

function getRecentMessages(limit) {
  const sheet = getOrCreateSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const reactionCountsByMessage = {};
  const messages = [];

  values.forEach(function(row) {
    const item = rowToObject_(row);
    const key = messageKey_(item.guestName, item.message);

    if (item.type === 'reaction' && item.reaction && item.message) {
      if (!reactionCountsByMessage[key]) reactionCountsByMessage[key] = {};
      reactionCountsByMessage[key][item.reaction] = (reactionCountsByMessage[key][item.reaction] || 0) + 1;
    }
  });

  values.reverse().forEach(function(row) {
    const item = rowToObject_(row);
    if ((item.type === 'rsvp' || item.type === 'message') && item.message) {
      const key = messageKey_(item.guestName, item.message);
      messages.push({
        timestamp: item.timestamp,
        guestName: item.guestName,
        message: item.message,
        reactionCounts: reactionCountsByMessage[key] || {},
      });
    }
  });

  return messages.slice(0, limit);
}

function rowToObject_(row) {
  return {
    timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ''),
    type: String(row[1] || '').toLowerCase(),
    guestName: String(row[2] || ''),
    attendance: String(row[3] || ''),
    guestCount: row[4],
    childName: String(row[5] || ''),
    message: String(row[6] || ''),
    dietaryNotes: String(row[7] || ''),
    reaction: String(row[8] || ''),
    userAgent: String(row[9] || ''),
  };
}

function messageKey_(guestName, message) {
  return `${String(guestName || '').trim().toLowerCase()}::${String(message || '').trim().toLowerCase()}`;
}

function clean_(value) {
  return String(value || '').trim().slice(0, 1000);
}

function jsonOutput(data) {
  // Apps Script Web Apps do not support full custom CORS headers through ContentService.
  // Returning JSON with ContentService and posting as text/plain from React avoids preflight issues.
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
