import type { AcademicEvent, Course, Lecture, LectureRow, Semester } from './types'

/**
 * The real catalogue of the Department of Informatics and Telematics,
 * Harokopio University.
 *
 * `COURSES` is the department's published course list, transcribed from
 * https://dit.hua.gr/index.php/el/programmata-spoudon/proptyxiako/mathimata —
 * all 73 courses across the eight semesters, with the department's own codes
 * (ΥΠxx υποχρεωτικό, ΕΠxx επιλογής, ΜΥxx μαθηματικά) and ECTS.
 *
 * `SCHEDULE` is when and where they met in spring 2025-2026, parsed from the
 * timetable PDF. Regenerate that half with:
 *
 *   npm run import:fixtures     # re-read the PDFs into __fixtures__
 *   npm run import:parse -- --seed
 *
 * and mirror everything into supabase/seed.sql with `npm run seed:sql`, so the
 * mock demo and the real database always show the same thing.
 *
 * ## Two gaps in the source, both deliberate
 *
 * The course list carries no lecturer. Where the timetable PDF names one it is
 * used; the rest say `Δεν έχει οριστεί` until an admin fills them in from the
 * Courses tab. `subject` is likewise not published anywhere — it is our own
 * filter dimension, guessed by `guessSubject` in the timetable parser.
 */

/** Every course in the list belongs to this department. */
const DEPARTMENT = 'Πληροφορικής και Τηλεματικής'

export const SEMESTER: Semester = {
  name: 'Spring 2026',
  // Tuesday — the term opens the day after Καθαρά Δευτέρα. Not a Monday, which
  // is why the semester validators no longer insist on one.
  start_date: '2026-02-24',
  end_date: '2026-06-05',
}

/**
 * What the department teaches. One row per course title — the identity a
 * timetable import matches on (src/lib/import/lectureMatch.ts).
 *
 * These are hand-maintained in the Courses tab and outlive any one term: a
 * PDF import re-times them, it never creates or edits them.
 */
export const COURSES: Course[] = [
  { id: '00000000-0000-4000-8000-000000000301', course_code: 'ΥΠ01', course_name: 'Εισαγωγή στην Πληροφορική και Τηλεματική', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#111111', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: true, study_year: 1, semester_number: 1, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000302', course_code: 'ΥΠ02', course_name: 'Προγραμματισμός Ι', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: true, study_year: 1, semester_number: 1, ects: 8.0 },
  { id: '00000000-0000-4000-8000-000000000303', course_code: 'ΥΠ04', course_name: 'Λογική Σχεδίαση', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#111111', subject: 'Συστήματα και υλικό', is_mandatory: true, study_year: 1, semester_number: 1, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000304', course_code: 'ΥΠ09', course_name: 'Διακριτά Μαθηματικά', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#111111', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: true, study_year: 1, semester_number: 1, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000305', course_code: 'ΜΥ01', course_name: 'Υπολογιστικά Μαθηματικά Ι', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#111111', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: true, study_year: 1, semester_number: 1, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000306', course_code: 'ΥΠ05', course_name: 'Προγραμματισμός ΙΙ', professor: 'Γ. Παπαδόπουλος', department: DEPARTMENT, color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: true, study_year: 1, semester_number: 2, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000307', course_code: 'ΥΠ08', course_name: 'Αρχιτεκτονική Υπολογιστών', professor: 'Α. Δημόπουλος', department: DEPARTMENT, color_tag: '#111111', subject: 'Συστήματα και υλικό', is_mandatory: true, study_year: 1, semester_number: 2, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000308', course_code: 'ΥΠ18', course_name: 'Αντικειμενοστρεφής Προγραμματισμός Ι', professor: 'Κ. Μπαρδάκη, Α. Χαραλαμπίδης', department: DEPARTMENT, color_tag: '#111111', subject: 'Προγραμματισμός', is_mandatory: true, study_year: 1, semester_number: 2, ects: 8.0 },
  { id: '00000000-0000-4000-8000-000000000309', course_code: 'ΜΥ02', course_name: 'Πιθανότητες', professor: 'Μ. Βαμβακάρη', department: DEPARTMENT, color_tag: '#111111', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: true, study_year: 1, semester_number: 2, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000310', course_code: 'ΜΥ03', course_name: 'Υπολογιστικά Μαθηματικά ΙΙ', professor: 'Χ. Μιχαλακέλης', department: DEPARTMENT, color_tag: '#111111', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: true, study_year: 1, semester_number: 2, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000311', course_code: 'ΥΠ10', course_name: 'Αντικειμενοστρεφής Προγραμματισμός ΙΙ', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#374151', subject: 'Προγραμματισμός', is_mandatory: true, study_year: 2, semester_number: 3, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000312', course_code: 'ΥΠ11', course_name: 'Δομές Δεδομένων', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#374151', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: true, study_year: 2, semester_number: 3, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000313', course_code: 'ΥΠ12', course_name: 'Λειτουργικά Συστήματα', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#374151', subject: 'Συστήματα και υλικό', is_mandatory: true, study_year: 2, semester_number: 3, ects: 7.0 },
  { id: '00000000-0000-4000-8000-000000000314', course_code: 'ΥΠ13', course_name: 'Δίκτυα Υπολογιστών', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#374151', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: true, study_year: 2, semester_number: 3, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000315', course_code: 'ΜΥ04', course_name: 'Στατιστική', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#374151', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: true, study_year: 2, semester_number: 3, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000316', course_code: 'ΥΠ06', course_name: 'Σήματα και Συστήματα', professor: 'Π. Ριζομυλιώτης', department: DEPARTMENT, color_tag: '#374151', subject: 'Συστήματα και υλικό', is_mandatory: true, study_year: 2, semester_number: 4, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000317', course_code: 'ΥΠ16', course_name: 'Βάσεις Δεδομένων', professor: 'Η. Βαρλάμης, Β. Ευθυμίου', department: DEPARTMENT, color_tag: '#374151', subject: 'Δεδομένα', is_mandatory: true, study_year: 2, semester_number: 4, ects: 8.0 },
  { id: '00000000-0000-4000-8000-000000000318', course_code: 'ΥΠ17', course_name: 'Ανάλυση Συστημάτων και Τεχνολογία Λογισμικού', professor: 'Κ. Μπαρδάκη', department: DEPARTMENT, color_tag: '#374151', subject: 'Πληροφοριακά συστήματα', is_mandatory: true, study_year: 2, semester_number: 4, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000319', course_code: 'ΥΠ19', course_name: 'Τεχνολογίες Εφαρμογών Ιστού', professor: 'Εξωτερικός Διδάσκων', department: DEPARTMENT, color_tag: '#374151', subject: 'Πληροφοριακά συστήματα', is_mandatory: true, study_year: 2, semester_number: 4, ects: 6.0 },
  { id: '00000000-0000-4000-8000-000000000320', course_code: 'ΥΠ25', course_name: 'Αλγόριθμοι και Πολυπλοκότητα', professor: 'Δ. Μιχαήλ', department: DEPARTMENT, color_tag: '#374151', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: true, study_year: 2, semester_number: 4, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000321', course_code: 'ΥΠ21', course_name: 'Κατανεμημένα Συστήματα', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Συστήματα και υλικό', is_mandatory: true, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000322', course_code: 'ΥΠ23', course_name: 'Τεχνητή Νοημοσύνη', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Τεχνητή νοημοσύνη', is_mandatory: true, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000323', course_code: 'ΥΠ27', course_name: 'Ασφάλεια Συστημάτων', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Ασφάλεια', is_mandatory: true, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000324', course_code: 'ΕΠ03', course_name: 'Σχεδίαση Βάσεων Δεδομένων και Κατανεμημένες Βάσεις Δεδομένων', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Δεδομένα', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000325', course_code: 'ΕΠ12', course_name: 'Διαχείριση Επιχειρηματικών Διαδικασιών στην Εφοδιαστική Αλυσίδα', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000326', course_code: 'ΕΠ13', course_name: 'Τεχνολογίες Διαδικτύου', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000327', course_code: 'ΕΠ37', course_name: 'Οικονομικά της Ψηφιακής Τεχνολογίας', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000328', course_code: 'ΕΠ49', course_name: 'Καινοτομία και Επιχειρηματικότητα', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000329', course_code: 'ΕΠ50', course_name: 'Αρχές Γλωσσών Προγραμματισμού', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000330', course_code: 'ΕΠ52', course_name: 'Ενσωματωμένα Συστήματα', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000331', course_code: 'ΕΠ54', course_name: 'Εφαρμοσμένα Μαθηματικά της Τεχνητής Νοημοσύνης και Βελτιστοποίηση', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Τεχνητή νοημοσύνη', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000332', course_code: 'ΕΠ225', course_name: 'Πληροφορική και Εκπαίδευση', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000333', course_code: 'ΕΠ245', course_name: 'Ανάπτυξη Κινητών Εφαρμογών', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000334', course_code: 'ΕΠ261', course_name: 'Προηγμένα Θέματα Λειτουργικών Συστημάτων', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 3, semester_number: 5, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000335', course_code: 'ΥΠ14', course_name: 'Τηλεπικοινωνιακά Συστήματα', professor: 'Θ.Καμαλάκης', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: true, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000336', course_code: 'ΥΠ24', course_name: 'Μοντελοποίηση και Προσομοίωση Συστημάτων', professor: 'Β. Δαλάκας', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Συστήματα και υλικό', is_mandatory: true, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000337', course_code: 'ΥΠ28', course_name: 'Πληροφοριακά Συστήματα', professor: 'Τ. Σταμάτη/Γ. Δέδε', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Πληροφοριακά συστήματα', is_mandatory: true, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000338', course_code: 'ΥΠ07', course_name: 'Εφαρμογές Ηλεκτρονικής και Διαδίκτυο των Πραγμάτων', professor: 'Θ. Καμαλάκης', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000339', course_code: 'ΕΠ02', course_name: 'Προγραμματισμός Συστημάτων', professor: 'Εξωτερικός Διδάσκων', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000340', course_code: 'ΕΠ10', course_name: 'Ψηφιακή Επεξεργασία Εικόνας και Εφαρμογές', professor: 'Γ. Παπαδόπουλος', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Τεχνητή νοημοσύνη', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000341', course_code: 'ΕΠ28', course_name: 'Κοινωνία και ΤΠΕ', professor: 'Χ. Σοφιανοπούλου', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000342', course_code: 'ΕΠ30', course_name: 'Υπηρεσίες και Συστήματα Διαδικτύου', professor: 'Γ. Κουσιουρής', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000343', course_code: 'ΕΠ32', course_name: 'Εφαρμογές Τηλεματικής στις Μεταφορές και την Υγεία', professor: 'Γ. Δημητρακόπουλος, Εξωτ. Διδάσκων', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000344', course_code: 'ΕΠ33', course_name: 'Μεταγλωττιστές', professor: 'Α. Χαραλαμπίδης', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000345', course_code: 'ΕΠ34', course_name: 'Μηχανική Μάθηση και Εφαρμογές', professor: 'Χ. Δίου', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Τεχνητή νοημοσύνη', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000346', course_code: 'ΕΠ35', course_name: 'Διδακτική της Πληροφορικής', professor: 'Χ. Σοφιανοπούλου, Α. Γασπαρινάτου', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000347', course_code: 'ΕΠ40', course_name: 'Συστήματα Λήψης Αποφάσεων', professor: 'Γ.Δέδε', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000348', course_code: 'ΕΠ55', course_name: 'Σχεδίαση Εφαρμογών και Συστημάτων', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#4B5563', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 3, semester_number: 6, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000349', course_code: 'ΜΥ05', course_name: 'Μεθοδολογία Επιστημονικής Έρευνας', professor: 'Χ. Σοφιανοπούλου, Α. Γασπαρινάτου', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: true, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000350', course_code: 'ΥΠ20', course_name: 'Αξιολόγηση Συστημάτων και Εφαρμογών', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000351', course_code: 'ΕΠ11', course_name: 'Οπτικές Επικοινωνίες', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000352', course_code: 'ΕΠ19', course_name: 'Εξόρυξη Δεδομένων', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Δεδομένα', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000353', course_code: 'ΕΠ20', course_name: 'Απόδοση Συστημάτων', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000354', course_code: 'ΕΠ21', course_name: 'Συστήματα Κινητών Επικοινωνιών', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000355', course_code: 'ΕΠ39', course_name: 'Κρυπτογραφία', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Ασφάλεια', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000356', course_code: 'ΕΠ42', course_name: 'Βασικές έννοιες και εργαλεία DevOps', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000357', course_code: 'ΕΠ43', course_name: 'Διδακτική ρομποτικής και εκπαίδευση STEM', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000358', course_code: 'ΕΠ46', course_name: 'Τεχνολογίες Γραφημάτων και Εφαρμογές', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Δεδομένα', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000359', course_code: 'ΕΠ57', course_name: 'Υπολογιστική όραση και Γραφικά', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Τεχνητή νοημοσύνη', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000360', course_code: 'ΕΠ58', course_name: 'Κβαντικοί Υπολογιστές και Αλγόριθμοι', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Αλγόριθμοι και μαθηματικά', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000361', course_code: 'ΕΠ59', course_name: 'Σχεδιασμός Πληροφοριακών Συστημάτων', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Συστήματα και υλικό', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000362', course_code: 'ΕΠ60', course_name: 'Σύγχρονες Τεχνολογίες Frontend', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 4, semester_number: 7, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000363', course_code: 'ΥΠ26', course_name: 'Σύγχρονες Παράλληλες Αρχιτεκτονικές και Προγραμματισμός Υψηλής Απόδοσης', professor: 'Εξωτερικός Διδάσκων', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Προγραμματισμός', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000364', course_code: 'ΕΠ23', course_name: 'Αποτίμηση Επενδύσεων Τεχνολογιών Πληροφορικής και Επικοινωνιών', professor: 'Χ. Μιχαλακέλης', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000365', course_code: 'ΕΠ29', course_name: 'Πληροφοριακά Συστήματα και Ηλεκτρονικό Επιχειρείν', professor: 'Μ. Σταμάτη', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000366', course_code: 'ΕΠ31', course_name: 'Διοίκηση Έργων Πληροφορικής', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000367', course_code: 'ΕΠ36', course_name: 'Παιδαγωγική Ψυχολογία', professor: 'Δ. Ζμπάινος', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Εκπαίδευση και κοινωνία', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000368', course_code: 'ΕΠ41', course_name: 'Ψηφιακές Δορυφορικές Επικοινωνίες', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000369', course_code: 'ΕΠ44', course_name: 'Διαχείριση Δικτύων Βασισμένων στο Λογισμικό', professor: 'Ε. Λιώτου', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000370', course_code: 'ΕΠ47', course_name: 'Διαχείριση Υπολογιστικού Νέφους', professor: 'Εξωτερικός Διδάσκων', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Δίκτυα και τηλεπικοινωνίες', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000371', course_code: 'ΕΠ53', course_name: 'Ασφάλεια στον Παγκόσμιο Ιστό', professor: 'Π. Ριζομυλιώτης', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Ασφάλεια', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000372', course_code: 'ΕΠ56', course_name: 'Διαχείριση μεγάλου όγκου δεδομένων και σημασιολογικός ιστός', professor: 'Β. Ευθυμίου', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Δεδομένα', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
  { id: '00000000-0000-4000-8000-000000000373', course_code: 'ΕΠ249', course_name: 'Ηλεκτρονική Διακυβέρνησης και Ψηφιακός Μετασχηματισμός', professor: 'Δεν έχει οριστεί', department: DEPARTMENT, color_tag: '#6B7280', subject: 'Πληροφοριακά συστήματα', is_mandatory: false, study_year: 4, semester_number: 8, ects: 5.0 },
]

/**
 * When and where each course meets, for the spring term.
 *
 * Scheduling only — every other field is inherited from `COURSES` through
 * `course_id`, which is what `CATALOGUE` below joins back on. A course with
 * two rows here (a lecture and its lab) meets twice a week.
 */
export const SCHEDULE: LectureRow[] = [
  // 2ο εξάμηνο — year 1
  { id: '00000000-0000-4000-8000-000000000001', course_id: '00000000-0000-4000-8000-000000000308', room: 'Αμφιθέατρο', day_of_week: 'Monday', start_time: '09:30', end_time: '12:00', semester: SEMESTER.name }, // Αντικειμενοστρεφής Προγραμματισμός Ι
  { id: '00000000-0000-4000-8000-000000000002', course_id: '00000000-0000-4000-8000-000000000306', room: 'Αμφιθέατρο', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Προγραμματισμός ΙΙ
  { id: '00000000-0000-4000-8000-000000000003', course_id: '00000000-0000-4000-8000-000000000306', room: 'Εργ. 4ου ορόφου', day_of_week: 'Tuesday', start_time: '09:00', end_time: '10:00', semester: SEMESTER.name }, // Προγραμματισμός ΙΙ
  { id: '00000000-0000-4000-8000-000000000004', course_id: '00000000-0000-4000-8000-000000000306', room: null, day_of_week: 'Tuesday', start_time: '10:00', end_time: '11:00', semester: SEMESTER.name }, // Προγραμματισμός ΙΙ
  { id: '00000000-0000-4000-8000-000000000005', course_id: '00000000-0000-4000-8000-000000000306', room: null, day_of_week: 'Tuesday', start_time: '11:00', end_time: '12:00', semester: SEMESTER.name }, // Προγραμματισμός ΙΙ
  { id: '00000000-0000-4000-8000-000000000006', course_id: '00000000-0000-4000-8000-000000000310', room: 'Αμφιθέατρο', day_of_week: 'Tuesday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Υπολογιστικά Μαθηματικά ΙΙ
  { id: '00000000-0000-4000-8000-000000000007', course_id: '00000000-0000-4000-8000-000000000307', room: 'Αμφιθέατρο', day_of_week: 'Wednesday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Αρχιτεκτονική Υπολογιστών
  { id: '00000000-0000-4000-8000-000000000008', course_id: '00000000-0000-4000-8000-000000000308', room: 'Εργ. 4ου ορόφου', day_of_week: 'Wednesday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Αντικειμενοστρεφής Προγραμματισμός Ι
  { id: '00000000-0000-4000-8000-000000000009', course_id: '00000000-0000-4000-8000-000000000307', room: 'Εργ. 2ου ορόφου', day_of_week: 'Friday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Αρχιτεκτονική Υπολογιστών
  { id: '00000000-0000-4000-8000-000000000010', course_id: '00000000-0000-4000-8000-000000000308', room: 'Εργ. 4ου ορόφου', day_of_week: 'Friday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Αντικειμενοστρεφής Προγραμματισμός Ι
  { id: '00000000-0000-4000-8000-000000000011', course_id: '00000000-0000-4000-8000-000000000309', room: 'Αμφιθέατρο', day_of_week: 'Friday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Πιθανότητες
  // 7ο εξάμηνο — year 4
  { id: '00000000-0000-4000-8000-000000000013', course_id: '00000000-0000-4000-8000-000000000349', room: 'Αίθουσα 3.7', day_of_week: 'Tuesday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Μεθοδολογία Επιστημονικής Έρευνας
  // 4ο εξάμηνο — year 2
  { id: '00000000-0000-4000-8000-000000000014', course_id: '00000000-0000-4000-8000-000000000318', room: 'Αμφιθέατρο', day_of_week: 'Wednesday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Ανάλυση Συστημάτων και Τεχνολογία Λογισμικού
  { id: '00000000-0000-4000-8000-000000000015', course_id: '00000000-0000-4000-8000-000000000319', room: 'Εργ. 4ου ορόφου', day_of_week: 'Wednesday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Τεχνολογίες Εφαρμογών Ιστού
  { id: '00000000-0000-4000-8000-000000000016', course_id: '00000000-0000-4000-8000-000000000317', room: 'Εργ. 2ου ορόφου', day_of_week: 'Thursday', start_time: '09:00', end_time: '15:00', semester: SEMESTER.name }, // Βάσεις Δεδομένων
  { id: '00000000-0000-4000-8000-000000000017', course_id: '00000000-0000-4000-8000-000000000319', room: 'Αμφιθέατρο', day_of_week: 'Thursday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Τεχνολογίες Εφαρμογών Ιστού
  { id: '00000000-0000-4000-8000-000000000018', course_id: '00000000-0000-4000-8000-000000000317', room: 'Αμφιθέατρο', day_of_week: 'Friday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Βάσεις Δεδομένων
  { id: '00000000-0000-4000-8000-000000000019', course_id: '00000000-0000-4000-8000-000000000316', room: 'Αμφιθέατρο', day_of_week: 'Friday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Σήματα και Συστήματα
  // 6ο εξάμηνο — year 3
  { id: '00000000-0000-4000-8000-000000000020', course_id: '00000000-0000-4000-8000-000000000339', room: 'Αίθουσα 2.3', day_of_week: 'Monday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Προγραμματισμός Συστημάτων
  { id: '00000000-0000-4000-8000-000000000021', course_id: '00000000-0000-4000-8000-000000000343', room: 'Αίθουσα 2.3', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Εφαρμογές Τηλεματικής στις Μεταφορές και την Υγεία
  { id: '00000000-0000-4000-8000-000000000022', course_id: '00000000-0000-4000-8000-000000000339', room: 'εργ. 2ου ορόφου', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Προγραμματισμός Συστημάτων
  { id: '00000000-0000-4000-8000-000000000023', course_id: '00000000-0000-4000-8000-000000000345', room: 'Αμφιθέατρο', day_of_week: 'Monday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Μηχανική Μάθηση και Εφαρμογές
  // 4ο εξάμηνο — year 2
  { id: '00000000-0000-4000-8000-000000000024', course_id: '00000000-0000-4000-8000-000000000320', room: 'Αμφιθέατρο Καραμπατζός', day_of_week: 'Tuesday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Αλγόριθμοι και Πολυπλοκότητα
  // 6ο εξάμηνο — year 3
  { id: '00000000-0000-4000-8000-000000000025', course_id: '00000000-0000-4000-8000-000000000346', room: 'Αίθουσα 2.3+ εργ. 2ου ορόφου', day_of_week: 'Tuesday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Διδακτική της Πληροφορικής
  { id: '00000000-0000-4000-8000-000000000026', course_id: '00000000-0000-4000-8000-000000000340', room: 'Αίθουσα 2.3 + εργ. 2ου ορόφου', day_of_week: 'Tuesday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Ψηφιακή Επεξεργασία Εικόνας και Εφαρμογές
  { id: '00000000-0000-4000-8000-000000000027', course_id: '00000000-0000-4000-8000-000000000342', room: 'Αίθουσα 2.3+ εργ. 4ου ορόφου', day_of_week: 'Wednesday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Υπηρεσίες και Συστήματα Διαδικτύου
  { id: '00000000-0000-4000-8000-000000000028', course_id: '00000000-0000-4000-8000-000000000347', room: 'Αίθουσα 2.3 + εργ. 2ου ορόφου', day_of_week: 'Wednesday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Συστήματα Λήψης Αποφάσεων
  { id: '00000000-0000-4000-8000-000000000029', course_id: '00000000-0000-4000-8000-000000000337', room: 'Αμφιθέατρο+εργ. 2ου ορόφου', day_of_week: 'Wednesday', start_time: '15:00', end_time: '19:00', semester: SEMESTER.name }, // Πληροφοριακά Συστήματα
  { id: '00000000-0000-4000-8000-000000000030', course_id: '00000000-0000-4000-8000-000000000335', room: 'Αμφιθέατρο', day_of_week: 'Thursday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Τηλεπικοινωνιακά Συστήματα
  { id: '00000000-0000-4000-8000-000000000031', course_id: '00000000-0000-4000-8000-000000000336', room: 'Αμφιθέατρο + εργ. 4ου ορόφου', day_of_week: 'Thursday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Μοντελοποίηση και Προσομοίωση Συστημάτων
  { id: '00000000-0000-4000-8000-000000000032', course_id: '00000000-0000-4000-8000-000000000341', room: 'Αίθουσα 2.3', day_of_week: 'Thursday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Κοινωνία και ΤΠΕ
  { id: '00000000-0000-4000-8000-000000000033', course_id: '00000000-0000-4000-8000-000000000338', room: 'Αίθουσα 2.3', day_of_week: 'Friday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Εφαρμογές Ηλεκτρονικής και Διαδίκτυο των Πραγμάτων
  { id: '00000000-0000-4000-8000-000000000034', course_id: '00000000-0000-4000-8000-000000000344', room: 'Αίθουσα 2.3 + εργ. 2ου ορόφου', day_of_week: 'Friday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Μεταγλωττιστές
  // 8ο εξάμηνο — year 4
  { id: '00000000-0000-4000-8000-000000000035', course_id: '00000000-0000-4000-8000-000000000370', room: 'Αίθουσα 3.9+εργ. 4ου ορόφου', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Διαχείριση Υπολογιστικού Νέφους
  { id: '00000000-0000-4000-8000-000000000036', course_id: '00000000-0000-4000-8000-000000000363', room: 'εργ.4ου ορόφου', day_of_week: 'Monday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Σύγχρονες Παράλληλες Αρχιτεκτονικές και Προγραμματισμός Υψηλής Απόδοσης
  { id: '00000000-0000-4000-8000-000000000037', course_id: '00000000-0000-4000-8000-000000000367', room: 'Αίθουσα 3.9', day_of_week: 'Tuesday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Παιδαγωγική Ψυχολογία
  { id: '00000000-0000-4000-8000-000000000038', course_id: '00000000-0000-4000-8000-000000000369', room: 'εργ.2ου ορόφου', day_of_week: 'Wednesday', start_time: '09:00', end_time: '12:00', semester: SEMESTER.name }, // Διαχείριση Δικτύων Βασισμένων στο Λογισμικό
  { id: '00000000-0000-4000-8000-000000000039', course_id: '00000000-0000-4000-8000-000000000365', room: 'Αίθουσα 3.9', day_of_week: 'Wednesday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Πληροφοριακά Συστήματα και Ηλεκτρονικό Επιχειρείν
  { id: '00000000-0000-4000-8000-000000000040', course_id: '00000000-0000-4000-8000-000000000371', room: 'Αίθουσα 3.9', day_of_week: 'Thursday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Ασφάλεια στον Παγκόσμιο Ιστό
  { id: '00000000-0000-4000-8000-000000000041', course_id: '00000000-0000-4000-8000-000000000364', room: 'Αίθουσα 3.9', day_of_week: 'Thursday', start_time: '15:00', end_time: '18:00', semester: SEMESTER.name }, // Αποτίμηση Επενδύσεων Τεχνολογιών Πληροφορικής και Επικοινωνιών
  { id: '00000000-0000-4000-8000-000000000042', course_id: '00000000-0000-4000-8000-000000000372', room: 'Αίθουσα 3.9', day_of_week: 'Friday', start_time: '12:00', end_time: '15:00', semester: SEMESTER.name }, // Διαχείριση μεγάλου όγκου δεδομένων και σημασιολογικός ιστός
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

/**
 * The term that is live today, so the app can always be demonstrated.
 *
 * It deliberately runs long. A lecture is only drawn on weeks its own term is
 * teaching (§22, `withinTerm`), so a demo term that expires turns the dashboard
 * back into the out-of-term notice on a date nobody planned for — which is
 * exactly what happened when this ended in September 2026. Widen the window
 * rather than shortening it.
 */
export const DEMO_SEMESTER: Semester = {
  name: 'Demo Term',
  // A Monday: validateSemesterInput rejects a term opening at the weekend.
  start_date: '2026-06-15',
  end_date: '2027-06-30',
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

/** The demo term's courses — same split as the real catalogue above. */
export const DEMO_COURSES: Course[] = [
  { id: '00000000-0000-4000-8000-0000000000c1', course_code: 'DEMO-101', course_name: 'Demo Course 101 — Introduction', professor: 'Demo Lecturer A', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: true, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000c2', course_code: 'DEMO-102', course_name: 'Demo Course 102 — Weekly Lecture', professor: 'Demo Lecturer B', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000c3', course_code: 'DEMO-103', course_name: 'Demo Course 103 — Laboratory', professor: 'Demo Lecturer B', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000c4', course_code: 'DEMO-104', course_name: 'Demo Course 104 — Afternoon Seminar', professor: 'Demo Lecturer C', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000c5', course_code: 'DEMO-105', course_name: 'Demo Course 105 — Midweek Workshop', professor: 'Demo Lecturer A', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000c6', course_code: 'DEMO-106', course_name: 'Demo Course 106 — Evening Class', professor: 'Demo Lecturer C', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 4, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000c7', course_code: 'DEMO-107', course_name: 'Demo Course 107 — Group 1', professor: 'Demo Lecturer B', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000c8', course_code: 'DEMO-107', course_name: 'Demo Course 107 — Group 2', professor: 'Demo Lecturer B', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000c9', course_code: 'DEMO-108', course_name: 'Demo Course 108 — Evening Tutorial', professor: 'Demo Lecturer A', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000ca', course_code: 'DEMO-109', course_name: 'Demo Course 109 — Morning Lecture', professor: 'Demo Lecturer C', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: true, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000cb', course_code: 'DEMO-110', course_name: 'Demo Course 110 — Afternoon Lab', professor: 'Demo Lecturer B', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000cc', course_code: 'DEMO-111', course_name: 'Demo Course 111 — Midday Seminar', professor: 'Demo Lecturer A', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
  { id: '00000000-0000-4000-8000-0000000000cd', course_code: 'DEMO-112', course_name: 'Demo Course 112 — Friday Afternoon Lecture', professor: 'Demo Lecturer C', department: DEMO_DEPARTMENT, color_tag: DEMO_COLOR, subject: DEMO_SUBJECT, is_mandatory: false, study_year: 3, semester_number: null, ects: 5.0 },
]

/**
 * A week built to exercise the things worth demonstrating: a Monday overlap for
 * the §8.4 conflict warning, one course split into two sections, a lecture with
 * no room so the fallback shows, and all three time bands including one class
 * late enough to reach the bottom of the 07:00-23:00 grid.
 *
 * Every weekday carries something in the morning *and* the afternoon, so the
 * dashboard, the "next up" countdown and "later today" all have something to
 * show whatever time of day the app is opened.
 */
export const DEMO_SCHEDULE: LectureRow[] = [
  // Monday — DEMO-102 and DEMO-103 overlap by an hour on purpose: this is the
  // pair the §8.4 conflict warning fires on.
  { id: '00000000-0000-4000-8000-0000000000d1', course_id: '00000000-0000-4000-8000-0000000000c1', room: 'Demo Room 1', day_of_week: 'Monday', start_time: '09:00', end_time: '11:00', semester: DEMO_SEMESTER.name },
  { id: '00000000-0000-4000-8000-0000000000d2', course_id: '00000000-0000-4000-8000-0000000000c2', room: 'Demo Room 2', day_of_week: 'Monday', start_time: '11:00', end_time: '13:00', semester: DEMO_SEMESTER.name },
  { id: '00000000-0000-4000-8000-0000000000d3', course_id: '00000000-0000-4000-8000-0000000000c3', room: 'Demo Lab', day_of_week: 'Monday', start_time: '12:00', end_time: '15:00', semester: DEMO_SEMESTER.name },
  { id: '00000000-0000-4000-8000-0000000000d9', course_id: '00000000-0000-4000-8000-0000000000c9', room: 'Demo Room 3', day_of_week: 'Monday', start_time: '17:00', end_time: '19:00', semester: DEMO_SEMESTER.name },
  // Tuesday
  { id: '00000000-0000-4000-8000-0000000000da', course_id: '00000000-0000-4000-8000-0000000000ca', room: 'Demo Room 1', day_of_week: 'Tuesday', start_time: '09:00', end_time: '12:00', semester: DEMO_SEMESTER.name },
  { id: '00000000-0000-4000-8000-0000000000d4', course_id: '00000000-0000-4000-8000-0000000000c4', room: 'Demo Room 1', day_of_week: 'Tuesday', start_time: '15:00', end_time: '18:00', semester: DEMO_SEMESTER.name },
  // Wednesday — DEMO-105 has no room, so the "room unknown" fallback shows.
  { id: '00000000-0000-4000-8000-0000000000d5', course_id: '00000000-0000-4000-8000-0000000000c5', room: null, day_of_week: 'Wednesday', start_time: '09:00', end_time: '12:00', semester: DEMO_SEMESTER.name },
  { id: '00000000-0000-4000-8000-0000000000db', course_id: '00000000-0000-4000-8000-0000000000cb', room: 'Demo Lab', day_of_week: 'Wednesday', start_time: '13:00', end_time: '16:00', semester: DEMO_SEMESTER.name },
  // Thursday — the evening class reaches the bottom of the grid.
  { id: '00000000-0000-4000-8000-0000000000dc', course_id: '00000000-0000-4000-8000-0000000000cc', room: 'Demo Room 2', day_of_week: 'Thursday', start_time: '10:00', end_time: '12:00', semester: DEMO_SEMESTER.name },
  { id: '00000000-0000-4000-8000-0000000000d6', course_id: '00000000-0000-4000-8000-0000000000c6', room: 'Demo Room 2', day_of_week: 'Thursday', start_time: '19:00', end_time: '22:00', semester: DEMO_SEMESTER.name },
  // Friday — one course split into two back-to-back groups.
  { id: '00000000-0000-4000-8000-0000000000d7', course_id: '00000000-0000-4000-8000-0000000000c7', room: 'Demo Lab', day_of_week: 'Friday', start_time: '09:00', end_time: '10:30', semester: DEMO_SEMESTER.name },
  { id: '00000000-0000-4000-8000-0000000000d8', course_id: '00000000-0000-4000-8000-0000000000c8', room: 'Demo Lab', day_of_week: 'Friday', start_time: '10:30', end_time: '12:00', semester: DEMO_SEMESTER.name },
  { id: '00000000-0000-4000-8000-0000000000dd', course_id: '00000000-0000-4000-8000-0000000000cd', room: 'Demo Room 1', day_of_week: 'Friday', start_time: '14:00', end_time: '17:00', semester: DEMO_SEMESTER.name },
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
  // These two must never sit on the week the app is being shown — a blocked
  // week correctly renders as "no classes", which looks like a broken demo.
  // They are spaced out so there is always one within a few weeks to page to.
  { id: '00000000-0000-4000-8000-000000002003', semester: null, kind: 'break', title: 'Demo break — no classes', start_date: '2026-10-19', end_date: '2026-10-23', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000002005', semester: null, kind: 'holiday', title: 'Demo public holiday', start_date: '2027-01-06', end_date: '2027-01-06', blocks_teaching: true },
  { id: '00000000-0000-4000-8000-000000002004', semester: null, kind: 'teaching_end', title: 'Demo term — teaching ends', start_date: '2027-06-30', end_date: '2027-06-30', blocks_teaching: false },
]

/**
 * What the app actually serves: the real timetable plus the demo term.
 *
 * `LECTURES` and `ACADEMIC_EVENTS` stay untouched above so a regenerated block
 * from `npm run import:parse -- --seed` can be pasted straight over them, and so
 * the tests and the landing-page preview that assert against the department's
 * real catalogue keep meaning what they say.
 */
export const ALL_COURSES: Course[] = [...COURSES, ...DEMO_COURSES]

/**
 * Every lecture with its course's fields folded in — the flat `Lecture` shape
 * the whole UI reads, and what both providers serve.
 *
 * This join is the fixture's stand-in for the one the providers do (a PostgREST
 * embed in supabase, a Map lookup in mock). Doing it here rather than writing
 * the fields out twice is the point of the split: change a course's name in
 * `COURSES` and every lecture of it changes with no other edit.
 */
export const CATALOGUE: Lecture[] = [...SCHEDULE, ...DEMO_SCHEDULE].map((row) => {
  const course = ALL_COURSES.find((c) => c.id === row.course_id)
  if (!course) throw new Error(`seed: no course for lecture ${row.id}`)
  // Spelled out rather than calling `joinCourse` from './types': this file is
  // loaded by scripts/generate-seed.mjs through Node's type stripping, which
  // erases `import type` but would have to resolve a real one.
  const { id: _id, ...fields } = course
  return { ...row, ...fields }
})

/** The real term's lectures alone, joined — what the tests assert against. */
export const LECTURES: Lecture[] = CATALOGUE.filter(
  (l) => l.semester === SEMESTER.name,
)

/** The demo term's lectures alone, joined. */
export const DEMO_LECTURES: Lecture[] = CATALOGUE.filter(
  (l) => l.semester === DEMO_SEMESTER.name,
)

/** The academic calendar the app serves, real entries plus the demo term's. */
export const CALENDAR: AcademicEvent[] = [...ACADEMIC_EVENTS, ...DEMO_ACADEMIC_EVENTS]

/** Every subject in the catalogue, for the filter pill. */
export const SUBJECTS = [...new Set(LECTURES.map((x) => x.subject!))].sort()

/** Every professor in the catalogue, for the filter pill. */
export const PROFESSORS = [...new Set(LECTURES.map((x) => x.professor))].sort()

/**
 * The spring selection: a plausible third-year enrolment from the real
 * catalogue.
 *
 * It deliberately includes both Monday 12:00-15:00 courses — Εφαρμογές
 * Τηλεματικής and the Προγραμματισμός Συστημάτων lab genuinely clash in the
 * published timetable — so the §8.4 conflict warning has something real to warn
 * about.
 *
 * Every id here resolves in `LECTURES`, which is what the landing page's hero
 * grid and the pure-logic tests rely on: both look rows up in the real-only
 * array and would get `undefined` for a demo-term id.
 */
export const SPRING_ENROLMENT = [
  '00000000-0000-4000-8000-000000000020', // Προγραμματισμός Συστημάτων, Mon 09:00
  '00000000-0000-4000-8000-000000000021', // Εφαρμογές Τηλεματικής, Mon 12:00
  '00000000-0000-4000-8000-000000000023', // Μηχανική Μάθηση, Mon 15:00
  '00000000-0000-4000-8000-000000000024', // Αλγόριθμοι και Πολυπλοκότητα, Tue 09:00
  '00000000-0000-4000-8000-000000000027', // Υπηρεσίες και Συστήματα Διαδικτύου, Wed 09:00
  '00000000-0000-4000-8000-000000000029', // Πληροφοριακά Συστήματα, Wed 15:00
  '00000000-0000-4000-8000-000000000030', // Τηλεπικοινωνιακά Συστήματα, Thu 09:00
  '00000000-0000-4000-8000-000000000033', // Εφαρμογές Ηλεκτρονικής, Fri 09:00
]

/**
 * The same, for the demo term. Group 2 of DEMO-107 is left out — a student
 * attends one group — and DEMO-102/DEMO-103 overlap so the conflict warning has
 * something to fire on here too.
 */
export const DEMO_ENROLMENT = [
  '00000000-0000-4000-8000-0000000000d1', // DEMO-101, Mon 09:00
  '00000000-0000-4000-8000-0000000000d2', // DEMO-102, Mon 11:00
  '00000000-0000-4000-8000-0000000000d3', // DEMO-103, Mon 12:00 — clashes with DEMO-102
  '00000000-0000-4000-8000-0000000000d9', // DEMO-108, Mon 17:00
  '00000000-0000-4000-8000-0000000000da', // DEMO-109, Tue 09:00
  '00000000-0000-4000-8000-0000000000d4', // DEMO-104, Tue 15:00
  '00000000-0000-4000-8000-0000000000d5', // DEMO-105, Wed 09:00 — no room
  '00000000-0000-4000-8000-0000000000db', // DEMO-110, Wed 13:00
  '00000000-0000-4000-8000-0000000000dc', // DEMO-111, Thu 10:00
  '00000000-0000-4000-8000-0000000000d6', // DEMO-106, Thu 19:00
  '00000000-0000-4000-8000-0000000000d7', // DEMO-107 Group 1, Fri 09:00
  '00000000-0000-4000-8000-0000000000dd', // DEMO-112, Fri 14:00
]

/**
 * What the mock provider pre-enrols the demo user in, so the dashboard is never
 * empty.
 *
 * It spans **both** terms on purpose. A student's enrolments outlive the term
 * they were made in, and `withinTerm` draws each lecture only on the weeks its
 * own semester is teaching — so the spring selection shows between February and
 * June, the demo term shows the rest of the time, and neither needs the other
 * to be deleted. Without the demo half, opening the app outside the spring term
 * shows the out-of-term notice and nothing else, which is not much of a demo.
 *
 * Resolve ids from this against `CATALOGUE`, never `LECTURES`.
 */
export const DEFAULT_ENROLMENT = [...SPRING_ENROLMENT, ...DEMO_ENROLMENT]

export const DEPARTMENTS = [...new Set(LECTURES.map((x) => x.department!))].sort()
