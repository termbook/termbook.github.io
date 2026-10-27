# School admin guide

## First time
1. Open the site, click **Register**, create your account and verify your email.
2. Choose **I am registering a school** and fill in the school and your details. Your name goes surname first. Dates are DD/MM/YYYY.
3. Your school shows as **waiting for verification** until the platform owner approves it (unless the owner has switched verification off). You can set up while you wait.
4. Open **Setup**. Under **School details** you can correct the school name, address, phone and email (the state and local government are changed by the platform owner). Then check your classes, arms, sections and subjects. A class does not need arms: leave its arms box empty and it shows on its own (for example SSS2). If you add arms (A, B, C or Science, Arts), students show with the arm. Sections for senior classes (Science, Arts, Commercial, Technical) are listed in the sections box. JSS and SS subjects are separate lists, so a teacher is only offered the subjects taught in each class. **Do this before teachers register**, because teachers choose from these lists.
5. In **Setup > Session and term** choose the session and term from the lists, pick the term start date (a Monday) with the day, month and year dropdowns, and set the weeks and the at-risk percentage. Dates are always chosen from dropdowns, never typed. In **Scoring** check the marks and grade boundaries before scoring starts.

## Teachers
Open **Teachers**. New requests wait under "Waiting for approval". Click **Review**, adjust the class teacher role and the exact subject and class ticks, then **Approve**. To fix a teacher who ticked the wrong classes, click **Edit** on their name, untick or tick the right ones and choose **Save roles**. A teacher sees nothing until approved. You can **Suspend** or change roles at any time.

## Students
Open **Students** to see everyone in your school.
- **Add student** opens a full form in sections: student details, parent or guardian (main contact), father and mother, emergency contact, health, and other. Only the name, gender and class are required; fill what you know. Family, health and other details are private: only the school admin and that class's teacher can see them. Health details are sensitive, so record only what the family has told the school.
- **Paste or import list**: tap **Download the blank template** (also on the Students page as **Download template**), fill it, and choose it (an Excel file works too). It has the same entries as the form, one column each, and every column is read by its heading. Before adding, you see how many students were found and any problems. Rows with a valid Class and Arm go to that class; the class you pick in the window is used for any row without one. Religion is not in the template; add it in the form if the family wants it recorded. You can also type a short list: `SURNAME Firstname, F, 2026/00123, R`.
- Filter by class and status, and search by name or admission number.
- Tick students, then use the bar at the top:
  - **Promote** moves each to the next class (the same arm if it exists). SS3 students become **Graduated**. You confirm first.
  - **Move to class** changes class and arm.
  - **No longer in school** tags students who left (withdrawn, transferred, not returning). They disappear from registers and score sheets but stay in the history. **Back in school** reverses it.
  - **Approve** confirms students added by class teachers (shown as Pending).
  - **Remove** hides a student (soft delete). Tick **Show removed** and **Restore** to bring one back.
- Open a student to edit details, or create a **parent access code**. The school admin can correct an admission number (open the student and edit it). The student's attendance, scores and parent access are kept, so tell the parent the new number. Class teachers can also correct admission numbers for students in their own class.
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

## Report cards
Termbook prints a student report card in the layout of the Oyo State school report card: header with two logos, student details, subject table (1st and 2nd term show C.A., exam and total; 3rd term adds the earlier terms and the average), behavioural and psychomotor ratings, comments, signature and the next term date.

**One-time setup, in Setup > Report card:**
1. Upload the **state or ministry crest** (shows on the left) and the **school logo** (shows on the right). Your school provides both; nothing is built in.
2. Upload the **principal's signature** (a small picture on a white or clear background).
3. Check the heading and school line, the footer line and the default comments, or press **Use the Oyo State format** to fill in the Oyo State wording. Then press **Save report card**.
4. In **Setup > Scoring**, the Oyo State format uses grades A (70 and above), C (50), P (40) and F. Press **Use the Oyo State format** and then **Save scoring**. Each grade line is `lowest mark | grade | meaning | remark`.
5. Set **Next term begins** (it prints at the bottom of the card) for the current term.

**For every term:** class teachers rate conduct and write the tutor's comment (see the teacher guide). You add the principal's comments. Open **Reports**, choose a class, and either:
- open **Conduct and comments** for one student and pick a **principal's comment template**, or
- tick students (or none) and press **Apply templates**: choose where to apply it (everyone in the class, only the ticked students, or every class in the school), then pick a principal's comment template. **Match each student's result** picks the comment that fits that student's total percentage (70% and above, 60%, 50%, 40%, below 40). Existing comments are kept unless you tick Replace.
Set your own wording in **Setup > Report card > Principal's comment templates** (one per line: lowest percentage | comment), or press **Fill in the sample templates** to start from the samples.

Then check the cards and press **Publish term results** so parents can see them.

What prints is calculated for you: subjects offered, passed and failed; class position, which is the rank by total percentage (students with the same percentage share a position); times school opened, present and absent from the attendance register (two marks per school day); totals and percentages, and in 3rd term the average of the terms the student was scored, rounded to one decimal (71.67 prints as 71.7). The class category on the card is the student's section (Science, Arts, Commercial or Technical), chosen on the student's record.
