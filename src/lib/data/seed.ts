import type { AcademicEvent, Lecture, Semester } from './types'

/**
 * The real catalogue of the Department of Informatics and Telematics,
 * Harokopio University, for the spring term of 2025-2026.
 *
 * Generated from the two source PDFs in the repository root by the import
 * parsers, then reviewed — exactly the path an admin takes through the Import
 * screen. Regenerate the arrays with:
 *
 *   npm run import:fixtures     # re-read the PDFs into __fixtures__
 *   npm run import:parse -- --seed
 *
 * and mirror the result into supabase/seed.sql with `npm run seed:sql`, so the
 * mock demo and the real database always show the same thing.
 *
 * Course codes do not appear anywhere in the source timetable; they are minted
 * by src/lib/import/courseCode.ts and are stable for a given course name.
 */

export const SEMESTER: Semester = {
  name: 'Spring 2026',
  // Tuesday — the term opens the day after Καθαρά Δευτέρα. Not a Monday, which
  // is why the semester validators no longer insist on one.
  start_date: '2026-02-24',
  end_date: '2026-06-05',
}

export const LECTURES: Lecture[] = [
  // Year 1 — 2ο εξάμηνο
  { id: '00000000-0000-4000-8000-000000000001', course_code: 'TPT2-ANTIKEIMENOSTREFIS-PROGRAMMATISMOS', course_name: 'Αντικειμενοστρεφής Προγραμματισμός Ι', professor: 'Κ. Μπαρδάκη, A. Χαραλαμπίδης', room: 'Αμφιθέατρο', day_of_week: 'Monday', start_time: '09:30', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000002', course_code: 'TPT2-PROGRAMMATISMOS', course_name: 'Προγραμματισμός ΙΙ', professor: 'Γ. Παπαδόπουλος', room: 'Αμφιθέατρο', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000003', course_code: 'TPT2-PROGRAMMATISMOS', course_name: 'Προγραμματισμός ΙΙ — Ομάδα 1', professor: 'Γ. Παπαδόπουλος', room: 'Εργ. 4ου ορόφου', day_of_week: 'Tuesday', start_time: '09:00', end_time: '10:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000004', course_code: 'TPT2-PROGRAMMATISMOS', course_name: 'Προγραμματισμός ΙΙ — Ομάδα 2', professor: 'Γ. Παπαδόπουλος', room: null, day_of_week: 'Tuesday', start_time: '10:00', end_time: '11:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000005', course_code: 'TPT2-PROGRAMMATISMOS', course_name: 'Προγραμματισμός ΙΙ — Ομάδα 3', professor: 'Γ. Παπαδόπουλος', room: null, day_of_week: 'Tuesday', start_time: '11:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000006', course_code: 'TPT2-YPOLOGISTIKA-MATHIMATIKA', course_name: 'Υπολογιστικά Μαθηματικά ΙΙ', professor: 'Χ. Μιχαλακέλης', room: 'Αμφιθέατρο', day_of_week: 'Tuesday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000007', course_code: 'TPT2-ARCHITEKTONIKI-YPOLOGISTON', course_name: 'Αρχιτεκτονική Υπολογιστών', professor: 'Α. Δημόπουλος', room: 'Αμφιθέατρο', day_of_week: 'Wednesday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000008', course_code: 'TPT2-ANTIKEIMENOSTREFIS-PROGRAMMATISMOS', course_name: 'Αντικειμενοστρεφής Προγραμματισμός Ι', professor: 'Κ. Μπαρδάκη, Α. Χαραλαμπίδης', room: 'Εργ. 4ου ορόφου', day_of_week: 'Wednesday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000009', course_code: 'TPT2-ARCHITEKTONIKI-YPOLOGISTON', course_name: 'Αρχιτεκτονική Υπολογιστών', professor: 'Α. Δημόπουλος', room: 'Εργ. 2ου ορόφου', day_of_week: 'Friday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000010', course_code: 'TPT2-ANTIKEIMENOSTREFIS-PROGRAMMATISMOS', course_name: 'Αντικειμενοστρεφής Προγραμματισμός Ι', professor: 'Κ. Μπαρδάκη, Α. Χαραλαμπίδης', room: 'Εργ. 4ου ορόφου', day_of_week: 'Friday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 1 },
  { id: '00000000-0000-4000-8000-000000000011', course_code: 'TPT2-PITHANOTITES', course_name: 'Πιθανότητες', professor: 'Μ. Βαμβακάρη', room: 'Αμφιθέατρο', day_of_week: 'Friday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#111111', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: false, study_year: 1 },
  // Year 2 — 4ο εξάμηνο
  { id: '00000000-0000-4000-8000-000000000013', course_code: 'TPT4-METHODOLOGIA-EPISTIMONIKIS', course_name: 'Μεθοδολογία Επιστημονικής Έρευνας', professor: 'Χ. Σοφιανοπούλου, Α. Γασπαρινάτου', room: 'Αίθουσα 3.7', day_of_week: 'Tuesday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#374151', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 2 },
  { id: '00000000-0000-4000-8000-000000000014', course_code: 'TPT4-ANALYSI-SYSTIMATON', course_name: 'Ανάλυση Συστημάτων και Τεχνολογία Λογισμικού', professor: 'Κ. Μπαρδάκη', room: 'Αμφιθέατρο', day_of_week: 'Wednesday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#374151', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 2 },
  { id: '00000000-0000-4000-8000-000000000015', course_code: 'TPT4-TECHNOLOGIES-EFARMOGON', course_name: 'Τεχνολογίες Εφαρμογών Ιστού', professor: 'Εξωτερικός Διδάσκων', room: 'Εργ. 4ου ορόφου', day_of_week: 'Wednesday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#374151', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 2 },
  { id: '00000000-0000-4000-8000-000000000016', course_code: 'TPT4-VASEIS-DEDOMENON', course_name: 'Βάσεις Δεδομένων', professor: 'Η. Βαρλάμης, Β. Ευθυμίου', room: 'Εργ. 2ου ορόφου', day_of_week: 'Thursday', start_time: '09:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#374151', subject: 'Δεδομένα', is_mandatory: false, study_year: 2 },
  { id: '00000000-0000-4000-8000-000000000017', course_code: 'TPT4-TECHNOLOGIES-EFARMOGON', course_name: 'Τεχνολογίες Εφαρμογών Ιστού', professor: 'Εξωτερικός Διδάσκων', room: 'Αμφιθέατρο', day_of_week: 'Thursday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#374151', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 2 },
  { id: '00000000-0000-4000-8000-000000000018', course_code: 'TPT4-VASEIS-DEDOMENON', course_name: 'Βάσεις Δεδομένων', professor: 'Η. Βαρλάμης, Β. Ευθυμίου', room: 'Αμφιθέατρο', day_of_week: 'Friday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#374151', subject: 'Δεδομένα', is_mandatory: false, study_year: 2 },
  { id: '00000000-0000-4000-8000-000000000019', course_code: 'TPT4-SIMATA-SYSTIMATA', course_name: 'Σήματα και Συστήματα', professor: 'Π. Ριζομυλιώτης', room: 'Αμφιθέατρο', day_of_week: 'Friday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#374151', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 2 },
  // Year 3 — 6ο εξάμηνο
  { id: '00000000-0000-4000-8000-000000000020', course_code: 'TPT6-PROGRAMMATISMOS-SYSTIMATON', course_name: 'Προγραμματισμός Συστημάτων', professor: 'Εξωτερικός Διδάσκων', room: 'Αίθουσα 2.3', day_of_week: 'Monday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000021', course_code: 'TPT6-EFARMOGES-TILEMATIKIS', course_name: 'Εφαρμογές Τηλεματικής στις Μεταφορές και την Υγεία', professor: 'Γ. Δημητρακόπουλος, Εξωτ. Διδάσκων', room: 'Αίθουσα 2.3', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000022', course_code: 'TPT6-PROGRAMMATISMOS-SYSTIMATON', course_name: 'Προγραμματισμός Συστημάτων', professor: 'Εξωτερικός Διδάσκων', room: 'εργ. 2ου ορόφου', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000023', course_code: 'TPT6-MICHANIKI-MATHISI', course_name: 'Μηχανική Μάθηση και Εφαρμογές', professor: 'Χ. Δίου', room: 'Αμφιθέατρο', day_of_week: 'Monday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Τεχνητή νοημοσύνη', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000024', course_code: 'TPT6-ALGORITHMOI-POLYPLOKOTITA', course_name: 'Αλγόριθμοι και Πολυπλοκότητα', professor: 'Δ. Μιχαήλ', room: 'Αμφιθέατρο Καραμπατζός', day_of_week: 'Tuesday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: true, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000025', course_code: 'TPT6-DIDAKTIKI-PLIROFORIKIS', course_name: 'Διδακτική της Πληροφορικής', professor: 'Χ. Σοφιανοπούλου, Α. Γασπαρινάτου', room: 'Αίθουσα 2.3+ εργ. 2ου ορόφου', day_of_week: 'Tuesday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000026', course_code: 'TPT6-PSIFIAKI-EPEXERGASIA', course_name: 'Ψηφιακή Επεξεργασία Εικόνας και Εφαρμογές', professor: 'Γ. Παπαδόπουλος', room: 'Αίθουσα 2.3 + εργ. 2ου ορόφου', day_of_week: 'Tuesday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Τεχνητή νοημοσύνη', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000027', course_code: 'TPT6-YPIRESIES-SYSTIMATA', course_name: 'Υπηρεσίες και Συστήματα Διαδικτύου', professor: 'Γ. Κουσιουρής', room: 'Αίθουσα 2.3+ εργ. 4ου ορόφου', day_of_week: 'Wednesday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000028', course_code: 'TPT6-SYSTIMATA-LIPSIS', course_name: 'Συστήματα Λήψης Αποφάσεων', professor: 'Γ.Δέδε', room: 'Αίθουσα 2.3 + εργ. 2ου ορόφου', day_of_week: 'Wednesday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000029', course_code: 'TPT6-PLIROFORIAKA-SYSTIMATA', course_name: 'Πληροφοριακά Συστήματα', professor: 'Τ. Σταμάτη/Γ. Δέδε', room: 'Αμφιθέατρο+εργ. 2ου ορόφου', day_of_week: 'Wednesday', start_time: '15:00', end_time: '19:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Πληροφοριακά συστήματα', is_mandatory: true, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000030', course_code: 'TPT6-TILEPIKOINONIAKA-SYSTIMATA', course_name: 'Τηλεπικοινωνιακά Συστήματα', professor: 'Θ.Καμαλάκης', room: 'Αμφιθέατρο', day_of_week: 'Thursday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: true, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000031', course_code: 'TPT6-MONTELOPOIISI-PROSOMOIOSI', course_name: 'Μοντελοποίηση και Προσομοίωση Συστημάτων', professor: 'Β. Δαλάκας', room: 'Αμφιθέατρο + εργ. 4ου ορόφου', day_of_week: 'Thursday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Συστήματα και υλικό', is_mandatory: true, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000032', course_code: 'TPT6-KOINONIA-TECHNOLOGIES', course_name: 'Κοινωνία και Τεχνολογίες Πληροφορίας και Επικοινωνιών', professor: 'Χ. Σοφιανοπούλου', room: 'Αίθουσα 2.3', day_of_week: 'Thursday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000033', course_code: 'TPT6-EFARMOGES-ILEKTRONIKIS', course_name: 'Εφαρμογές Ηλεκτρονικής και Διαδίκτυο των Πραγμάτων', professor: 'Θ. Καμαλάκης', room: 'Αίθουσα 2.3', day_of_week: 'Friday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-000000000034', course_code: 'TPT6-METAGLOTTISTES', course_name: 'Μεταγλωττιστές', professor: 'Α. Χαραλαμπίδης', room: 'Αίθουσα 2.3 + εργ. 2ου ορόφου', day_of_week: 'Friday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#4B5563', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 3 },
  // Year 4 — 8ο εξάμηνο
  { id: '00000000-0000-4000-8000-000000000035', course_code: 'TPT8-DIACHEIRISI-YPOLOGISTIKOU', course_name: 'Διαχείριση Υπολογιστικού Νέφους', professor: 'Εξωτερικός Διδάσκων', room: 'Αίθουσα 3.9+εργ. 4ου ορόφου', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-000000000036', course_code: 'TPT8-SYGCHRONES-PARALLILES', course_name: 'Σύγχρονες Παράλληλες Αρχιτεκτονικές και Προγραμματισμός Υψηλής Απόδοσης', professor: 'Εξωτερικός Διδάσκων', room: 'εργ.4ου ορόφου', day_of_week: 'Monday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-000000000037', course_code: 'TPT8-PAIDAGOGIKI-PSYCHOLOGIA', course_name: 'Παιδαγωγική Ψυχολογία', professor: 'Δ. Ζμπάινος', room: 'Αίθουσα 3.9', day_of_week: 'Tuesday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-000000000038', course_code: 'TPT8-DIACHEIRISI-DIKTYON', course_name: 'Διαχείριση Δικτύων Βασισμένων στο Λογισμικό', professor: 'Ε. Λιώτου', room: 'εργ.2ου ορόφου', day_of_week: 'Wednesday', start_time: '09:00', end_time: '12:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-000000000039', course_code: 'TPT8-PLIROFORIAKA-SYSTIMATA', course_name: 'Πληροφοριακά Συστήματα και Ηλεκτρονικό Επιχειρείν', professor: 'Μ. Σταμάτη', room: 'Αίθουσα 3.9', day_of_week: 'Wednesday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-000000000040', course_code: 'TPT8-ASFALEIA-PAGKOSMIO', course_name: 'Ασφάλεια στον Παγκόσμιο Ιστό', professor: 'Π. Ριζομυλιώτης', room: 'Αίθουσα 3.9', day_of_week: 'Thursday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Ασφάλεια', is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-000000000041', course_code: 'TPT8-APOTIMISI-EPENDYSEON', course_name: 'Αποτίμηση Επενδύσεων ΤΠΕ', professor: 'Χ. Μιχαλακέλης', room: 'Αίθουσα 3.9', day_of_week: 'Thursday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-000000000042', course_code: 'TPT8-DIACHEIRISI-MEGALOU', course_name: 'Διαχείριση μεγάλου όγκου δεδομένων και σημασιολογικός ιστός', professor: 'Β. Ευθυμίου', room: 'Αίθουσα 3.9', day_of_week: 'Friday', start_time: '12:00', end_time: '15:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Δεδομένα', is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-000000000043', course_code: 'TPT8-ANAKTISI-PLIROFORIAS', course_name: 'Ανάκτηση Πληροφορίας και Επεξεργασία Φυσικής Γλώσσας', professor: 'Η. Βαρλάμης', room: 'εργ.4ου ορόφου', day_of_week: 'Friday', start_time: '15:00', end_time: '18:00', semester: 'Spring 2026', department: 'Πληροφορικής και Τηλεματικής', color_tag: '#6B7280', subject: 'Τεχνητή νοημοσύνη', is_mandatory: false, study_year: 4 },
]

export const ACADEMIC_EVENTS: AcademicEvent[] = [
  { id: '00000000-0000-4000-8000-000000001001', semester: null, kind: 'teaching_start', title: 'Έναρξη μαθημάτων χειμερινού εξαμήνου', start_date: '2025-10-06', end_date: '2025-10-06', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001002', semester: null, kind: 'holiday', title: 'Αργία 28ης Οκτωβρίου', start_date: '2025-10-28', end_date: '2025-10-28', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001003', semester: null, kind: 'holiday', title: 'Αργία 17η Νοεμβρίου', start_date: '2025-11-17', end_date: '2025-11-17', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001004', semester: null, kind: 'teaching_end', title: 'Λήξη Μαθημάτων Δεκεμβρίου', start_date: '2025-12-22', end_date: '2025-12-22', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001005', semester: null, kind: 'break', title: 'Διακοπές Χριστουγέννων-Πρωτοχρονιάς', start_date: '2025-12-23', end_date: '2026-01-06', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001006', semester: null, kind: 'teaching_start', title: 'Έναρξη Μαθημάτων Ιανουαρίου 2026', start_date: '2026-01-07', end_date: '2026-01-07', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001007', semester: null, kind: 'teaching_end', title: 'Λήξη Μαθημάτων χειμερινού εξαμήνου (13 εβδ.)', start_date: '2026-01-16', end_date: '2026-01-16', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001008', semester: null, kind: 'makeup_week', title: 'Εβδομάδα αναπληρώσεων μαθημάτων, εργαστηρίων κλπ', start_date: '2026-01-19', end_date: '2026-01-23', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001009', semester: null, kind: 'exam_period', title: 'Έναρξη Εξεταστικής Περιόδου χειμερινού εξαμήνου 2025-2026', start_date: '2026-01-26', end_date: '2026-01-26', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001010', semester: null, kind: 'exam_period', title: 'Λήξη Εξεταστικής Περιόδου χειμερινού εξαμήνου 2025-2026', start_date: '2026-02-20', end_date: '2026-02-20', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001011', semester: null, kind: 'presentations', title: 'Παρουσιάσεις πτυχιακών εργασιών', start_date: '2026-02-11', end_date: '2026-02-20', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001012', semester: null, kind: 'holiday', title: 'Αργία Καθαράς Δευτέρας', start_date: '2026-02-23', end_date: '2026-02-23', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001013', semester: 'Spring 2026', kind: 'teaching_start', title: 'Έναρξη μαθημάτων εαρινού εξαμήνου', start_date: '2026-02-24', end_date: '2026-02-24', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001014', semester: 'Spring 2026', kind: 'holiday', title: 'Αργία 25ης Μαρτίου', start_date: '2026-03-25', end_date: '2026-03-25', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001015', semester: 'Spring 2026', kind: 'break', title: 'Λήξη Μαθημάτων (διακοπές Πάσχα)', start_date: '2026-04-03', end_date: '2026-04-03', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001016', semester: 'Spring 2026', kind: 'break', title: 'Διακοπές Πάσχα', start_date: '2026-04-06', end_date: '2026-04-17', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001017', semester: 'Spring 2026', kind: 'teaching_start', title: 'Έναρξη Μαθημάτων (μετά το Πάσχα)', start_date: '2026-04-20', end_date: '2026-04-20', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001018', semester: 'Spring 2026', kind: 'holiday', title: 'Αργία Πρωτομαγιάς', start_date: '2026-05-01', end_date: '2026-05-01', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001019', semester: 'Spring 2026', kind: 'holiday', title: 'Αργία Αγίου Πνεύματος', start_date: '2026-06-01', end_date: '2026-06-01', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001020', semester: 'Spring 2026', kind: 'teaching_end', title: 'Λήξη Μαθημάτων Εαρινού Εξαμήνου (13 εβδ.)', start_date: '2026-06-05', end_date: '2026-06-05', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001021', semester: null, kind: 'makeup_week', title: 'Εβδομάδα αναπληρώσεων μαθημάτων, εργαστηρίων κλπ', start_date: '2026-06-08', end_date: '2026-06-12', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000001022', semester: null, kind: 'exam_period', title: 'Έναρξη Εξεταστικής Περιόδου εαρινού εξαμήνου 2025-2026', start_date: '2026-06-15', end_date: '2026-06-15', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001023', semester: null, kind: 'exam_period', title: 'Λήξη Εξεταστικής Περιόδου εαρινού εξαμήνου 2025-2026', start_date: '2026-07-03', end_date: '2026-07-03', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000001024', semester: null, kind: 'presentations', title: 'Παρουσιάσεις πτυχιακών εργασιών', start_date: '2026-06-30', end_date: '2026-07-10', blocks_teaching: false },
]

// ---------------------------------------------------------------------------
// Demo term
//
// A fictional term that exists only so the app can be shown working during an
// active semester. Everything above is a snapshot of spring 2025-2026, and a
// lecture is only drawn on weeks its own term is teaching (§22, `withinTerm`),
// so outside February-June the real catalogue correctly renders as out of term
// — correct, and useless for a demo.
//
// Every value below is named so it cannot be mistaken for the department's real
// timetable: 'DEMO-' codes, 'Demo Lecturer' staff, 'Demo Department'. Deleting
// the four exports in this section removes the whole thing.
// ---------------------------------------------------------------------------

/** Spans the 2026 summer, so this is the term that is live today. */
export const DEMO_SEMESTER: Semester = {
  name: 'Demo Term (summer 2026)',
  // A Monday: validateSemesterInput rejects a term opening at the weekend.
  start_date: '2026-06-15',
  end_date: '2026-09-30',
}

/**
 * Every term in the fixture. The real one stays first and stays `is_current` —
 * the demo term does not need that flag (its calendar entries are filed under a
 * null semester, see below), and moving it would change which term the admin
 * Import screen defaults to.
 */
export const SEMESTERS: Semester[] = [SEMESTER, DEMO_SEMESTER]

const DEMO_DEPARTMENT = 'Demo Department'
const DEMO_SUBJECT = 'Demo courses'
const DEMO_COLOR = '#6B7280'

/**
 * A week built to exercise the things worth demonstrating: a Monday overlap for
 * the §8.4 conflict warning, one course split into two sections, a lecture with
 * no room so the fallback shows, and all three time bands including one class
 * late enough to reach the bottom of the 07:00-23:00 grid.
 */
export const DEMO_LECTURES: Lecture[] = [
  { id: '00000000-0000-4000-8000-0000000000d1', course_code: 'DEMO-101', course_name: 'Demo Course 101 — Introduction', professor: 'Demo Lecturer A', room: 'Demo Room 1', day_of_week: 'Monday', start_time: '09:00', end_time: '11:00', semester: DEMO_SEMESTER.name, department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: true, study_year: 3 },
  { id: '00000000-0000-4000-8000-0000000000d2', course_code: 'DEMO-102', course_name: 'Demo Course 102 — Weekly Lecture', professor: 'Demo Lecturer B', room: 'Demo Room 2', day_of_week: 'Monday', start_time: '11:00', end_time: '13:00', semester: DEMO_SEMESTER.name, department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3 },
  // Overlaps DEMO-102 by an hour — this is the pair the conflict warning fires on.
  { id: '00000000-0000-4000-8000-0000000000d3', course_code: 'DEMO-103', course_name: 'Demo Course 103 — Laboratory', professor: 'Demo Lecturer B', room: 'Demo Lab', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: DEMO_SEMESTER.name, department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-0000000000d4', course_code: 'DEMO-104', course_name: 'Demo Course 104 — Afternoon Seminar', professor: 'Demo Lecturer C', room: 'Demo Room 1', day_of_week: 'Tuesday', start_time: '15:00', end_time: '18:00', semester: DEMO_SEMESTER.name, department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-0000000000d5', course_code: 'DEMO-105', course_name: 'Demo Course 105 — Midweek Workshop', professor: 'Demo Lecturer A', room: null, day_of_week: 'Wednesday', start_time: '09:00', end_time: '12:00', semester: DEMO_SEMESTER.name, department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-0000000000d6', course_code: 'DEMO-106', course_name: 'Demo Course 106 — Evening Class', professor: 'Demo Lecturer C', room: 'Demo Room 2', day_of_week: 'Thursday', start_time: '19:00', end_time: '22:00', semester: DEMO_SEMESTER.name, department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 4 },
  { id: '00000000-0000-4000-8000-0000000000d7', course_code: 'DEMO-107', course_name: 'Demo Course 107 — Group 1', professor: 'Demo Lecturer B', room: 'Demo Lab', day_of_week: 'Friday', start_time: '09:00', end_time: '10:30', semester: DEMO_SEMESTER.name, department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3 },
  { id: '00000000-0000-4000-8000-0000000000d8', course_code: 'DEMO-107', course_name: 'Demo Course 107 — Group 2', professor: 'Demo Lecturer B', room: 'Demo Lab', day_of_week: 'Friday', start_time: '10:30', end_time: '12:00', semester: DEMO_SEMESTER.name, department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3 },
]

/**
 * Calendar entries for the demo term, filed under a null semester on purpose.
 *
 * Both providers fetch the *current* term's rows plus the year-wide (null) ones,
 * and the current term is still the real spring one — null is what makes these
 * reach the grid without moving `is_current`. They give the §22 features
 * something to show: a struck-through Monday and a week the grid calls off.
 */
export const DEMO_ACADEMIC_EVENTS: AcademicEvent[] = [
  { id: '00000000-0000-4000-8000-000000002001', semester: null, kind: 'teaching_start', title: 'Demo term — teaching starts', start_date: '2026-06-15', end_date: '2026-06-15', blocks_teaching: false },
  { id: '00000000-0000-4000-8000-000000002002', semester: null, kind: 'holiday', title: 'Demo holiday — no classes', start_date: '2026-08-17', end_date: '2026-08-17', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000002003', semester: null, kind: 'break', title: 'Demo break — no classes', start_date: '2026-09-07', end_date: '2026-09-11', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000002004', semester: null, kind: 'teaching_end', title: 'Demo term — teaching ends', start_date: '2026-09-30', end_date: '2026-09-30', blocks_teaching: false },
]

/**
 * What the app actually serves: the real timetable plus the demo term.
 *
 * `LECTURES` and `ACADEMIC_EVENTS` stay untouched above so a regenerated block
 * from `npm run import:parse -- --seed` can be pasted straight over them, and so
 * the tests and the landing-page preview that assert against the department's
 * real catalogue keep meaning what they say.
 */
export const CATALOGUE: Lecture[] = [...LECTURES, ...DEMO_LECTURES]

/** The academic calendar the app serves, real entries plus the demo term's. */
export const CALENDAR: AcademicEvent[] = [...ACADEMIC_EVENTS, ...DEMO_ACADEMIC_EVENTS]

/** Every subject in the catalogue, for the filter pill. */
export const SUBJECTS = [...new Set(LECTURES.map((x) => x.subject!))].sort()

/** Every professor in the catalogue, for the filter pill. */
export const PROFESSORS = [...new Set(LECTURES.map((x) => x.professor))].sort()

/**
 * Pre-enrolled courses for the mock demo, so the dashboard is never empty.
 *
 * A plausible third-year selection. It deliberately includes both Monday
 * 12:00-15:00 courses — Εφαρμογές Τηλεματικής and the Προγραμματισμός
 * Συστημάτων lab genuinely clash in the published timetable — so the §8.4
 * conflict warning has something real to warn about.
 */
export const DEFAULT_ENROLMENT = [
  '00000000-0000-4000-8000-000000000020', // Προγραμματισμός Συστημάτων, Mon 09:00
  '00000000-0000-4000-8000-000000000021', // Εφαρμογές Τηλεματικής, Mon 12:00
  '00000000-0000-4000-8000-000000000023', // Μηχανική Μάθηση, Mon 15:00
  '00000000-0000-4000-8000-000000000024', // Αλγόριθμοι και Πολυπλοκότητα, Tue 09:00
  '00000000-0000-4000-8000-000000000027', // Υπηρεσίες και Συστήματα Διαδικτύου, Wed 09:00
  '00000000-0000-4000-8000-000000000029', // Πληροφοριακά Συστήματα, Wed 15:00
  '00000000-0000-4000-8000-000000000030', // Τηλεπικοινωνιακά Συστήματα, Thu 09:00
  '00000000-0000-4000-8000-000000000033', // Εφαρμογές Ηλεκτρονικής, Fri 09:00
]

export const DEPARTMENTS = [...new Set(LECTURES.map((x) => x.department!))].sort()
