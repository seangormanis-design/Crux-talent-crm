// Must match the backend's InteractionType enum exactly — shared by full
// Person interaction logging (People.tsx) and lightweight Target Contact
// interaction logging (OpportunityDetail.tsx), since both log the same way.
export const INTERACTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "PHONE_CALL", label: "Phone call" },
  { value: "VIDEO_MEETING", label: "Video meeting" },
  { value: "FACE_TO_FACE", label: "Face to face meeting" },
  { value: "QUALIFICATION_CALL", label: "Main qualification" },
  { value: "LINKEDIN_MESSAGE", label: "LinkedIn message" },
  { value: "EMAIL", label: "Email" },
  { value: "TEXT", label: "Text" },
];
