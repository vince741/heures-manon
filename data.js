const BENEFICIARY_COLORS = [
  ["yellow", "Jaune"], ["purple", "Violet"], ["blue", "Bleu"], ["green", "Vert"],
  ["pink", "Rose"], ["orange", "Orange"], ["teal", "Turquoise"], ["slate", "Ardoise"]
];
const validColors = new Set(BENEFICIARY_COLORS.map(([color]) => color));
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isId = value => typeof value === "string" && value.trim().length > 0;
const optionalText = value => value == null || typeof value === "string";
const isTime = value => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);

function isPlanningDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(date + "T00:00:00Z");
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date;
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
        !isId(entry.name) || ![entry.address, entry.phone, entry.notes].every(optionalText)) {
      throw new Error("La sauvegarde contient une fiche bénéficiaire invalide ou en double.");
    }
    peopleIds.add(entry.id);
  }

  for (const [date, visits] of Object.entries(data.visits)) {
    if (!isPlanningDate(date) || !Array.isArray(visits)) {
      throw new Error("La sauvegarde contient une journée invalide.");
    }
    const visitIds = new Set();
    for (const visit of visits) {
      if (!isRecord(visit) || !isId(visit.id) || visitIds.has(visit.id) ||
          !isId(visit.personId) || !isTime(visit.start) || !isTime(visit.end) ||
          (visit.travel != null && visit.travel !== "" && !isTime(visit.travel)) || !optionalText(visit.note)) {
        throw new Error(`La sauvegarde contient une intervention invalide ou en double le ${date}.`);
      }
      visitIds.add(visit.id);
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

function mergePlanningData(current, incoming) {
  const existingPeople = new Set(current.people.map(entry => entry.id));
  const addedPeople = incoming.people.filter(entry => !existingPeople.has(entry.id));
  const additions = { people: addedPeople.length, visits: 0 };
  const visits = { ...current.visits };

  for (const [date, day] of Object.entries(incoming.visits)) {
    const currentDay = visits[date] || [];
    const existingVisits = new Set(currentDay.map(visit => visit.id));
    const addedVisits = day.filter(visit => !existingVisits.has(visit.id));
    if (addedVisits.length) visits[date] = [...currentDay, ...addedVisits];
    additions.visits += addedVisits.length;
  }

  return { data: assignBeneficiaryColors({ ...current, people: [...current.people, ...addedPeople], visits }), additions };
}

function countPlanningData(data) {
  return { people: data.people.length, visits: Object.values(data.visits).reduce((total, day) => total + day.length, 0) };
}
