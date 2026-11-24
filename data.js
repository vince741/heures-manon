const BENEFICIARY_COLORS = [
  ["yellow", "Jaune"], ["purple", "Violet"], ["blue", "Bleu"], ["green", "Vert"],
  ["pink", "Rose"], ["orange", "Orange"], ["teal", "Turquoise"], ["slate", "Ardoise"]
];
const validColors = new Set(BENEFICIARY_COLORS.map(([color]) => color));
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isId = value => typeof value === "string" && value.trim().length > 0;
const optionalText = value => value == null || typeof value === "string";
const isTime = value => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
const VISIT_STATUS = { planned: "Prévue", done: "Réalisée", cancelled: "Annulée" };
const DAY_MINUTES = 1440;
const DAY_MS = 86400000;
const planningDateKey = date => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function parseTime(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function duration(start, end) {
  const difference = parseTime(end) - parseTime(start);
  return difference < 0 ? difference + DAY_MINUTES : difference;
}

const dayTime = date => Date.parse(date + "T00:00:00Z");
const dayKeyFromTime = time => new Date(time).toISOString().slice(0, 10);

function visitInterval(date, visit) {
  const start = dayTime(date) / 60000 + parseTime(visit.start);
  return { start, end: start + duration(visit.start, visit.end) };
}

function visitStatusForLegacy(date, visit, now) {
  const currentMinute = dayTime(planningDateKey(now)) / 60000 + now.getHours() * 60 + now.getMinutes();
  return visitInterval(date, visit).end <= currentMinute ? "done" : "planned";
}

function isPlanningDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(date + "T00:00:00Z");
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date;
}

function isPlanningVisit(visit) {
  return isRecord(visit) && isId(visit.id) && isId(visit.personId) &&
    isTime(visit.start) && isTime(visit.end) &&
    (visit.travel == null || visit.travel === "" || isTime(visit.travel)) &&
    optionalText(visit.note) && (visit.status == null || Object.hasOwn(VISIT_STATUS, visit.status));
}

function parsePlanningBackup(text) {
  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Ce fichier n’est pas un JSON valide.");
  }
  if (!isRecord(data) || !Array.isArray(data.people) || !isRecord(data.visits)) {
    throw new Error("Choisissez une sauvegarde JSON créée dans AidePlanning.");
  }

  const peopleIds = new Set();
  for (const entry of data.people) {
    if (!isRecord(entry) || !isId(entry.id) || peopleIds.has(entry.id) ||
        !isId(entry.name) || ![entry.address, entry.phone, entry.notes].every(optionalText) ||
        (entry.archived != null && typeof entry.archived !== "boolean")) {
      throw new Error("La sauvegarde contient une fiche bénéficiaire invalide ou en double.");
    }
    peopleIds.add(entry.id);
  }

  const visitIds = new Set();
  for (const [date, visits] of Object.entries(data.visits)) {
    if (!isPlanningDate(date) || !Array.isArray(visits)) {
      throw new Error("La sauvegarde contient une journée invalide.");
    }
    for (const visit of visits) {
      if (!isPlanningVisit(visit) || visitIds.has(visit.id)) {
        throw new Error(`La sauvegarde contient une intervention invalide ou en double le ${date}.`);
      }
      visitIds.add(visit.id);
    }
  }
  if (data.trash != null) {
    if (!Array.isArray(data.trash)) throw new Error("La corbeille de la sauvegarde est invalide.");
    for (const entry of data.trash) {
      if (!isRecord(entry) || !isPlanningDate(entry.date) || !isPlanningVisit(entry.visit) || visitIds.has(entry.visit.id)) {
        throw new Error("La corbeille contient une intervention invalide ou en double.");
      }
      visitIds.add(entry.visit.id);
    }
  }
  return data;
}

function leastUsedColor(people, fallback = BENEFICIARY_COLORS[0][0]) {
  const counts = new Map(BENEFICIARY_COLORS.map(([color]) => [color, 0]));
  for (const { color } of people) {
    if (counts.has(color)) counts.set(color, counts.get(color) + 1);
  }
  return [...counts].reduce((best, [color, count]) => count < counts.get(best) ? color : best, fallback);
}

function assignBeneficiaryColors(data) {
  const people = data.people.filter(entry => validColors.has(entry.color));
  const colored = data.people.map(entry => {
    if (validColors.has(entry.color)) return entry;
    const updated = { ...entry, color: leastUsedColor(people) };
    people.push(updated);
    return updated;
  });
  return { ...data, people: colored };
}

function preparePlanningData(data, now = new Date()) {
  const prepareVisit = (date, visit) => visit.status ? visit : { ...visit, status: visitStatusForLegacy(date, visit, now) };
  const visits = Object.fromEntries(Object.entries(data.visits).map(([date, day]) => [date, day.map(visit => prepareVisit(date, visit))]));
  const trash = (data.trash || []).map(entry => ({ ...entry, visit: prepareVisit(entry.date, entry.visit) }));
  return { ...assignBeneficiaryColors(data), visits, trash };
}

function mergePlanningData(current, incoming) {
  const existingPeople = new Set(current.people.map(entry => entry.id));
  const addedPeople = incoming.people.filter(entry => !existingPeople.has(entry.id));
  const additions = { people: addedPeople.length, visits: 0, trash: 0 };
  const visits = { ...current.visits };
  const trash = [...(current.trash || [])];
  const existingVisits = new Set(Object.values(visits).flat().map(visit => visit.id));
  trash.forEach(entry => existingVisits.add(entry.visit.id));

  for (const [date, day] of Object.entries(incoming.visits)) {
    const currentDay = visits[date] || [];
    const addedVisits = day.filter(visit => !existingVisits.has(visit.id));
    if (addedVisits.length) {
      visits[date] = [...currentDay, ...addedVisits];
      addedVisits.forEach(visit => existingVisits.add(visit.id));
    }
    additions.visits += addedVisits.length;
  }
  for (const entry of incoming.trash || []) {
    if (existingVisits.has(entry.visit.id)) continue;
    trash.push(entry);
    existingVisits.add(entry.visit.id);
    additions.trash++;
  }

  return { data: preparePlanningData({ ...current, people: [...current.people, ...addedPeople], visits, trash }), additions };
}

function countPlanningData(data) {
  return { people: data.people.length, visits: Object.values(data.visits).reduce((total, day) => total + day.length, 0), trash: data.trash?.length || 0 };
}

function weeklyDates(start, last) {
  const dates = [];
  for (let time = dayTime(start), end = dayTime(last); time <= end; time += 7 * DAY_MS) {
    dates.push(dayKeyFromTime(time));
  }
  return dates;
}

function conflictsOnDate(visitsByDate, date) {
  const day = dayTime(date);
  const active = key => (visitsByDate[key] || [])
    .filter(visit => visit.status !== "cancelled" && duration(visit.start, visit.end) > 0)
    .map(visit => ({ visit, date: key, ...visitInterval(key, visit) }));
  const current = active(date);
  const adjacent = [...active(dayKeyFromTime(day - DAY_MS)), ...active(dayKeyFromTime(day + DAY_MS))];
  const pairs = [];
  current.forEach((first, index) => {
    for (const second of [...current.slice(index + 1), ...adjacent]) {
      if (first.start < second.end && second.start < first.end) pairs.push([first, second]);
    }
  });
  return pairs;
}

function visitTotals(visits) {
  const totals = { planned: 0, done: 0, travel: 0, plannedCount: 0, doneCount: 0, cancelledCount: 0 };
  for (const visit of visits) {
    if (visit.status === "cancelled") totals.cancelledCount++;
    else if (visit.status === "planned") {
      totals.planned += duration(visit.start, visit.end);
      totals.plannedCount++;
    } else {
      totals.done += duration(visit.start, visit.end);
      totals.travel += parseTime(visit.travel);
      totals.doneCount++;
    }
  }
  return totals;
}
