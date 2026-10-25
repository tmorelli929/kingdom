export const metadata = { title: "Privacy · Kingdom" };

// Public page: Google's consent screen links here.
export default function Privacy() {
  return (
    <main className="login">
      <div className="card" style={{ maxWidth: 640, textAlign: "left" }}>
        <span className="brand">KINGDOM</span>
        <h1 style={{ fontSize: 24 }}>Privacy</h1>
        <p className="muted">Kingdom is a private, personal dashboard. Only accounts on its allowlist can sign in. Last updated October 25, 2026.</p>

        <h2 style={{ fontSize: 17 }}>What Kingdom stores</h2>
        <p>Your name and email from Google sign-in, and what you enter yourself: daily intentions, habits, goals, reflections, your coach conversations, and the people, conversations and commitments in your network.</p>

        <h2 style={{ fontSize: 17 }}>Connected Google data</h2>
        <p>Calendar and Gmail access are optional and separate from sign-in. Kingdom asks for read-only access, uses it only to show your schedule and the messages you choose, and never sends email or changes your calendar. Access tokens are encrypted at rest. You can disconnect at any time in Setup, which revokes access with Google.</p>
        <p>Kingdom&apos;s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. Google data is not sold, used for advertising, or shared with anyone, and is not used to train AI models.</p>

        <h2 style={{ fontSize: 17 }}>The AI coach</h2>
        <p>When you ask the coach a question, Kingdom sends a short summary of the data you allow in Setup to Anthropic&apos;s API to generate the answer. Anthropic does not train on API data. People you mark private are never included, and full email histories are never sent.</p>

        <h2 style={{ fontSize: 17 }}>Your control</h2>
        <p>Setup lets you export everything as JSON, choose what the coach can see, disconnect integrations, and delete your account and all of its data permanently.</p>

        <p className="small faint"><a href="/">Back to Kingdom</a></p>
      </div>
    </main>
  );
}
