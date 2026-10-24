# School admin guide

## First time
1. Open the site, click **Register**, create your account and verify your email.
2. Choose **I am registering a school** and fill in the school and your details. Your name goes surname first. Dates are DD/MM/YYYY.
3. Your school shows as **waiting for verification** until the platform owner approves it (unless the owner has switched verification off). You can set up while you wait.
4. Open **Setup** and check your classes, arms, SS departments and subjects. JSS and SS subjects are separate lists, so a teacher is only offered the subjects taught in each class. **Do this before teachers register**, because teachers choose from these lists.
5. In **Setup > Session and term** enter the session (for example 2026/2027), the term, the term start date (a Monday), weeks and the at-risk percentage. In **Scoring** check the marks and grade boundaries before scoring starts.

## Teachers
Open **Teachers**. New requests wait under "Waiting for approval". Click **Review**, adjust the class teacher role and the exact subject and class ticks, then **Approve**. To fix a teacher who ticked the wrong classes, click **Edit** on their name, untick or tick the right ones and choose **Save roles**. A teacher sees nothing until approved. You can **Suspend** or change roles at any time.

## Students
Open **Students** to see everyone in your school.
- **Add student** one by one, or **Paste or import list** and tap **Download the blank template** (also on the Students page as **Download template**), fill it, and choose it (an Excel file works too). The file is read directly, column by column: Name, Gender, Class, Arm, Admission no., Repeater (R), Date of birth (DD/MM/YYYY), Parent/guardian name, Address, Parent phone. Before adding, you see how many students were found and any problems. Rows with a valid Class and Arm go to that class; the class you pick in the window is used for any row without one. You can also type a list: `SURNAME Firstname, F, 2026/00123, R`.
- Filter by class and status, and search by name or admission number.
- Tick students, then use the bar at the top:
  - **Promote** moves each to the next class (the same arm if it exists). SS3 students become **Graduated**. You confirm first.
  - **Move to class** changes class and arm.
  - **No longer in school** tags students who left (withdrawn, transferred, not returning). They disappear from registers and score sheets but stay in the history. **Back in school** reverses it.
  - **Approve** confirms students added by class teachers (shown as Pending).
  - **Remove** hides a student (soft delete). Tick **Show removed** and **Restore** to bring one back.
- Open a student to edit details, or create a **parent access code**. Admission numbers cannot be changed after saving.
- The religion field is optional and off by default.

## Starting a new term or session
**Setup > Session and term > Start next term.** Past data stays. After the 3rd term you are offered to promote all active students. Then set the new term's start date.

## Publishing results
Open **Reports**. Check a class's report cards, then **Publish term results**. Parents see results only after this. **Hide from parents** reverses it. Publish again after corrections.

## Parent access
Open a student, click **Create code**, and give the parent the admission number and code. **Revoke access** removes the code and any linked parent.

## Holidays
**Attendance > Holidays**: add dates. If the platform owner published national holidays, tap **Accept all**.

## Backup
**Setup > Download backup (Excel)** regularly. It contains students, teachers, attendance and scores.

## Bringing over existing lists
Termbook starts fresh. To move a class from your old sheets, copy the names into a text file in the format above and use **Paste or import list** for each class and arm.
