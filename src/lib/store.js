/** Session state shared by all screens. */
export const state = { user: null, profile: null, school: null, isOwner: false, schoolId: null, students: [], unsubs: [] };
export const roleOf = () => (state.isOwner ? "owner" : state.profile?.role || null);
export const effectiveSchoolId = () => state.schoolId || state.profile?.schoolId || null;
