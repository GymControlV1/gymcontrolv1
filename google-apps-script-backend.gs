const WORKOUTS_SHEET = "workouts";
const USERS_SHEET = "users";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action;

    if (action === "ping") {
      return jsonResponse({ ok: true, message: "pong" });
    }

    if (action === "saveWorkout") {
      return jsonResponse(saveWorkout(payload));
    }

    if (action === "getWorkoutHistory") {
      return jsonResponse(getWorkoutHistory(payload));
    }

    return jsonResponse({ ok: false, error: "Unknown action" });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || "Unexpected error" });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(sheetName, headers) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(headers);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function ensureUsersSheet_() {
  return getOrCreateSheet_(USERS_SHEET, [
    "user_id",
    "profile_name",
    "created_at",
    "updated_at"
  ]);
}

function ensureWorkoutsSheet_() {
  return getOrCreateSheet_(WORKOUTS_SHEET, [
    "workout_id",
    "user_id",
    "profile_name",
    "date",
    "split",
    "sets_json",
    "created_at"
  ]);
}

function upsertUser_(user) {
  const sheet = ensureUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const now = new Date().toISOString();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(user.userId)) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[
        user.profileName || "",
        values[i][2] || now,
        now
      ]]);
      return;
    }
  }

  sheet.appendRow([
    user.userId,
    user.profileName || "",
    now,
    now
  ]);
}

function saveWorkout(payload) {
  const user = payload.user || {};
  const workout = payload.workout || {};

  if (!user.userId) {
    throw new Error("Missing userId");
  }

  if (!workout.id) {
    throw new Error("Missing workout id");
  }

  upsertUser_(user);

  const sheet = ensureWorkoutsSheet_();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(workout.id) && String(values[i][1]) === String(user.userId)) {
      return { ok: true, duplicate: true };
    }
  }

  sheet.appendRow([
    workout.id,
    user.userId,
    user.profileName || "",
    workout.date || "",
    workout.split || "",
    JSON.stringify(workout.sets || []),
    new Date().toISOString()
  ]);

  return { ok: true };
}

function getWorkoutHistory(payload) {
  const user = payload.user || {};
  if (!user.userId) {
    throw new Error("Missing userId");
  }

  const sheet = ensureWorkoutsSheet_();
  const values = sheet.getDataRange().getValues();
  const workouts = [];

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) !== String(user.userId)) continue;

    workouts.push({
      id: values[i][0],
      date: values[i][3],
      split: values[i][4],
      sets: JSON.parse(values[i][5] || "[]")
    });
  }

  workouts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { ok: true, workouts };
}
