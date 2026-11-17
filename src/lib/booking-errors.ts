export const BOOKING_ERRORS: Record<string, string> = {
  slot_taken: "Sorry, that time was just taken. Please choose another slot.",
  too_far_ahead: "That date is too far in the future to book online.",
  doctor_unavailable: "That doctor is not available right now.",
  forbidden: "You can't book for that patient.",
  too_late_to_cancel:
    "It's too close to the appointment time to cancel online. Please call or WhatsApp the clinic.",
  not_cancellable: "This appointment can no longer be cancelled.",
  failed: "Something went wrong. Please try again.",
};

export function errorCode(message: string | undefined): string {
  if (!message) return "failed";
  return Object.keys(BOOKING_ERRORS).find((k) => message.includes(k)) ?? "failed";
}
