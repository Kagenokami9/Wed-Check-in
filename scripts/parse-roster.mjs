#!/usr/bin/env node
/**
 * Dynamic roster parser: reads `student-list-2569.md` and outputs `src/data/roster.json`.
 * Never hardcodes room count or student count — re-run `npm run sync:roster` whenever the
 * source markdown changes to update all rooms and students across the app automatically.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const SOURCE_FILE = path.join(projectRoot, "student-list-2569.md");
const OUTPUT_FILE = path.join(projectRoot, "src", "data", "roster.json");

function parseRosterMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const rooms = [];
  const students = [];
  const seenStudentIds = new Set();

  let currentRoom = null;
  let inTable = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Match room section headings such as: "## ชั้นมัธยมศึกษาปีที่ 1/5"
    const roomHeadingMatch = line.match(/^##\s+ชั้นมัธยมศึกษาปีที่\s+(\d+)\/(\d+)\s*$/);
    if (roomHeadingMatch) {
      const grade = Number.parseInt(roomHeadingMatch[1], 10);
      const roomNumber = Number.parseInt(roomHeadingMatch[2], 10);
      const id = `m${grade}-${roomNumber}`;
      currentRoom = {
        id,
        name: `ม.${grade}/${roomNumber}`,
        grade,
        roomNumber,
        program: "",
        homeroomTeachers: "",
      };
      rooms.push(currentRoom);
      inTable = false;
      continue;
    }

    if (!currentRoom) {
      continue;
    }

    // Room metadata bullets
    const programMatch = line.match(/^-\s+\*\*แผนการเรียน:\*\*\s*(.+)$/);
    if (programMatch) {
      currentRoom.program = programMatch[1].trim();
      continue;
    }

    const teacherMatch = line.match(/^-\s+\*\*ครูประจำชั้น:\*\*\s*(.+)$/);
    if (teacherMatch) {
      currentRoom.homeroomTeachers = teacherMatch[1].trim();
      continue;
    }

    // Detect table header
    if (line.startsWith("| เลขที่ |")) {
      inTable = true;
      continue;
    }

    // Skip divider row
    if (inTable && /^\|[\s:|-]+\|$/.test(line)) {
      continue;
    }

    // Parse student table rows
    if (inTable && line.startsWith("|")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

      if (cells.length >= 5) {
        const seatNumber = Number.parseInt(cells[0], 10);
        const studentCode = cells[1];
        const prefix = cells[2];
        const firstName = cells[3];
        const lastName = cells[4];
        const rosterNote = cells[5] ? cells[5].trim() : "";

        if (!Number.isNaN(seatNumber) && studentCode && firstName) {
          // Ensure deterministic unique ID even if source ever has duplicate student code
          let id = studentCode;
          if (seenStudentIds.has(id)) {
            id = `${currentRoom.id}-${seatNumber}-${studentCode}`;
          }
          seenStudentIds.add(id);

          const student = {
            id,
            studentCode,
            roomId: currentRoom.id,
            seatNumber,
            prefix,
            firstName,
            lastName,
          };

          if (rosterNote) {
            student.rosterNote = rosterNote;
          }

          students.push(student);
        }
      }
      continue;
    }

    if (inTable && line === "") {
      inTable = false;
    }
  }

  // Sort rooms dynamically by grade ascending, then roomNumber ascending
  rooms.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.roomNumber - b.roomNumber;
  });

  // Sort students within each room by seatNumber ascending
  const roomOrder = new Map(rooms.map((room, index) => [room.id, index]));
  students.sort((a, b) => {
    const orderDiff = (roomOrder.get(a.roomId) ?? 0) - (roomOrder.get(b.roomId) ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.seatNumber - b.seatNumber;
  });

  return {
    sourceFile: "student-list-2569.md",
    academicYear: "2569",
    generatedAt: new Date().toISOString(),
    rooms,
    students,
  };
}

function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`[sync:roster] Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(SOURCE_FILE, "utf8");
  const roster = parseRosterMarkdown(markdown);

  if (roster.rooms.length === 0 || roster.students.length === 0) {
    console.error("[sync:roster] Failed to parse any rooms or students from source markdown.");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(roster, null, 2) + "\n", "utf8");

  console.log(
    `[sync:roster] Generated ${path.relative(projectRoot, OUTPUT_FILE)} — ${roster.rooms.length} rooms, ${roster.students.length} students.`
  );
  for (const room of roster.rooms) {
    const count = roster.students.filter((s) => s.roomId === room.id).length;
    console.log(`  - ${room.name} (${room.id}): ${count} students`);
  }
}

main();
