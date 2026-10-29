# Data model

Every school's data lives under `schools/{schoolId}/...`. Access is decided by `firestore.rules`.

| Path | Holds | Who reads | Who writes |
|---|---|---|---|
| `config/platform` | `requireVerification` | any signed-in user | owner |
| `config/holidays` | national holidays | any signed-in user | owner |
| `publicSchools/{sid}` | name, state, LGA, class and subject lists | anyone | owner; admin (own, verified) |
| `users/{uid}` | role, school, status, class teacher key, assignments, `links` (parents) | self, school admin, owner | self (limited), admin (teachers), owner |
| `schools/{sid}` | details, structure, scoring, report card settings, logos and signature, current session and term, status | school staff, owner | admin (not status), owner |
| `schools/{sid}/students/{admissionKey}` | name, gender, class, arm, `classKey`, status, repeater, soft-delete flag | admin, owner, teachers of that class, linked parent | admin, owner, class teacher (pending only) |
| `.../students/{id}/private/info` | home address, origin, previous school, parent/guardian, father, mother and emergency contact details, health details, transport and notes, religion (optional) | admin, owner, class teacher, the linked parent | same, and the linked parent (family, health, emergency and address details only) |
| `.../admissionIndex/{admissionKey}` | maps a corrected admission number to the student's record id | admin, owner, staff; a parent can look up one number | admin, owner; class teacher (create or delete, own class) |
| `.../studentAttendance/{session_studentId}` | days present (`d`) and school days (`od`) for one student | class teacher, admin, owner, the linked parent | class teacher, admin, owner |
| `.../absenceNotes/{studentId_date}` | a parent's reason for an absence | the class teacher, admin, owner, the parent who wrote it | the linked parent; deleted by the parent or admin |
| `.../accessCodes/{studentId}` | parent code, active flag | admin, owner | admin, owner |
| `.../links/{uid_studentId}` | parent link (code checked by rules) | admin, owner, that parent | parent (with correct code), admin |
| `.../attendance/{classKey_date}` | marks per student | class teacher, admin, owner | same |
| `.../holidays/{date}` | reason | staff | admin, owner |
| `.../terms/{session_term}` | start date, weeks, at-risk %, published flag | staff | admin, owner |
| `.../sheets/{session__subject__class}` | scores by term and student | that subject teacher, class teacher, admin, owner | subject teacher, admin, owner |
| `.../remarks/{term_studentId}` | conduct ratings, class tutor's comment and name, principal's comment | class teacher, admin, owner | class teacher (not the principal's comment), admin, owner |
| `.../reports/{term_studentId}` | compiled report card (subjects, totals, attendance, conduct, comments) | admin, owner, class teacher, linked parent once published | admin, owner |
| `audit/{id}` | who, what, when | admin of that school, owner | any member (create only) |

`classKey` is `CLASS|ARM`, for example `SS2|A`. A student's document id is derived from the admission number when the student is created and never changes. If the admin later corrects the admission number, the `admissionIndex` maps the new number to that id.
