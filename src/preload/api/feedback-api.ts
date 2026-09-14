export type FeedbackApi = {
  submit: (args: {
    feedback: string
    submitAnonymously?: boolean
    githubLogin: string | null
    githubEmail: string | null
    images?: { contentType: string; data: Uint8Array }[]
  }) => Promise<
    { ok: true; imagesDelivered?: boolean } | { ok: false; status: number | null; error: string }
  >
}
