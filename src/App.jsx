import { useEffect, useMemo, useRef, useState } from 'react';

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';
const WHATSAPP_URL =
  'https://wa.me/19548606616?text=Hi%20Sarah%2C%20I%20have%20a%20question%20about%20Joaquim%27s%204th%20birthday%20party';

const EMPTY_FORM = {
  guestName: '',
  attendance: 'Yes',
  guestCount: '1',
  childName: '',
  message: '',
  dietaryNotes: '',
};

const STARTER_WISHES = [
  {
    id: 'starter-1',
    guestName: 'Birthday Crew',
    message: 'Counting down to a beautiful day for Joaquim! 💙',
    reactionCounts: { '🎂': 1, '🎈': 2, '💙': 3, '🥳': 1, '⭐': 1 },
    createdAt: new Date().toISOString(),
  },
];

const REACTIONS = ['🎂', '🎈', '💙', '🥳', '⭐'];

function createLocalWish(form) {
  return {
    id: `local-${Date.now()}`,
    guestName: form.guestName.trim(),
    message:
      form.message.trim() ||
      `${form.guestName.trim()} ${form.attendance === 'Yes' ? 'is excited to celebrate' : 'sent birthday love'}!`,
    reactionCounts: {},
    createdAt: new Date().toISOString(),
  };
}

async function sendToGoogleSheets(payload) {
  if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_DEPLOYED_SCRIPT_ID')) {
    throw new Error('Google Apps Script URL is not configured yet.');
  }

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: {
      // text/plain avoids a browser preflight request and works well with Apps Script doPost(e).
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      userAgent: navigator.userAgent,
    }),
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The RSVP endpoint returned an unreadable response.');
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'The RSVP could not be saved.');
  }

  return data;
}

function FloatingDecorations() {
  return (
    <div className="decorations" aria-hidden="true">
      <span className="balloon balloon-one">🎈</span>
      <span className="balloon balloon-two">🎈</span>
      <span className="balloon balloon-three">🎈</span>
      <span className="star star-one">⭐</span>
      <span className="star star-two">✦</span>
      <span className="bubble bubble-one" />
      <span className="bubble bubble-two" />
      <span className="bubble bubble-three" />
      <span className="cloud cloud-one" />
      <span className="cloud cloud-two" />
    </div>
  );
}

function MusicControl() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.28;
    audio.loop = true;

    const attemptPlay = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
        setNeedsTap(false);
      } catch {
        setNeedsTap(true);
      } finally {
        setIsReady(true);
      }
    };

    attemptPlay();
  }, []);

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
        setNeedsTap(false);
      } catch {
        setNeedsTap(true);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="music-wrap" aria-live="polite">
      <audio ref={audioRef} src="/joaquimtheme.mp3" preload="auto" />
      {needsTap && (
        <button className="music-prompt" onClick={toggleMusic} type="button">
          Tap to play Joaquim&apos;s birthday music ✨
        </button>
      )}
      <button
        className="music-button"
        onClick={toggleMusic}
        type="button"
        aria-label={isPlaying ? 'Pause birthday music' : 'Play birthday music'}
        title={isPlaying ? 'Pause music' : 'Play music'}
      >
        <span aria-hidden="true">{isPlaying ? '⏸️' : '🎵'}</span>
      </button>
      {!isReady && <span className="sr-only">Loading music control</span>}
    </div>
  );
}

function Hero() {
  const scrollToRsvp = () => {
    document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="hero">
      <div className="hero-card glass-card">
        <p className="eyebrow">You&apos;re invited</p>
        <h1>Joaquim is turning 4!</h1>
        <p className="hero-copy">
          Join us for a sweet pastel-blue celebration filled with smiles, music, birthday wishes,
          and a little magic for Joaquim&apos;s special day.
        </p>

        <div className="hero-actions" aria-label="Invitation actions">
          <button className="primary-button" type="button" onClick={scrollToRsvp}>
            Confirm Presence
          </button>
          <a className="secondary-button" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            Contact Sarah on WhatsApp
          </a>
        </div>
      </div>

      <aside className="age-card" aria-label="Joaquim is turning four">
        <span className="age-number">4</span>
        <span className="age-label">years of joy</span>
      </aside>
    </header>
  );
}

function RSVPForm({ onWishAdded }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    const count = Number(form.guestCount);

    if (!form.guestName.trim()) nextErrors.guestName = 'Please enter your name.';
    if (!['Yes', 'No', 'Maybe'].includes(form.attendance)) {
      nextErrors.attendance = 'Please choose Yes, No, or Maybe.';
    }
    if (!Number.isInteger(count) || count < 1 || count > 25) {
      nextErrors.guestCount = 'Enter a guest count between 1 and 25.';
    }
    if (form.message.length > 220) {
      nextErrors.message = 'Please keep the birthday message under 220 characters.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    setStatus({ type: 'idle', message: '' });

    const wish = createLocalWish(form);

    try {
      await sendToGoogleSheets({
        type: 'rsvp',
        guestName: form.guestName.trim(),
        attendance: form.attendance,
        guestCount: Number(form.guestCount),
        childName: form.childName.trim(),
        message: form.message.trim(),
        dietaryNotes: form.dietaryNotes.trim(),
        reaction: '',
      });

      onWishAdded(wish);
      setConfettiKey((key) => key + 1);
      setStatus({
        type: 'success',
        message: 'Thank you! Sarah received your RSVP for Joaquim’s birthday.',
      });
      setForm(EMPTY_FORM);
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error.message ||
          'We could not save the RSVP right now. Your form is still here, so please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="section rsvp-section" id="rsvp" aria-labelledby="rsvp-title">
      <div className="section-heading">
        <p className="eyebrow">RSVP</p>
        <h2 id="rsvp-title">Confirm your presence</h2>
        <p>
          Sarah will receive your RSVP, and your birthday wish can appear on Joaquim&apos;s happy
          guest wall.
        </p>
      </div>

      <div className="form-shell glass-card">
        {confettiKey > 0 && <Confetti key={confettiKey} />}
        <form onSubmit={submitForm} noValidate>
          <div className="field-group">
            <label htmlFor="guestName">Guest name *</label>
            <input
              id="guestName"
              name="guestName"
              type="text"
              value={form.guestName}
              onChange={updateField}
              placeholder="Your name"
              autoComplete="name"
              aria-invalid={Boolean(errors.guestName)}
              aria-describedby={errors.guestName ? 'guestName-error' : undefined}
              required
            />
            {errors.guestName && (
              <span className="field-error" id="guestName-error">
                {errors.guestName}
              </span>
            )}
          </div>

          <fieldset className="field-group attendance-group">
            <legend>Attending status *</legend>
            <div className="segmented-control">
              {['Yes', 'No', 'Maybe'].map((option) => (
                <label key={option} className={form.attendance === option ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="attendance"
                    value={option}
                    checked={form.attendance === option}
                    onChange={updateField}
                  />
                  {option}
                </label>
              ))}
            </div>
            {errors.attendance && <span className="field-error">{errors.attendance}</span>}
          </fieldset>

          <div className="form-grid-two">
            <div className="field-group">
              <label htmlFor="guestCount">Number of guests *</label>
              <input
                id="guestCount"
                name="guestCount"
                type="number"
                min="1"
                max="25"
                inputMode="numeric"
                value={form.guestCount}
                onChange={updateField}
                aria-invalid={Boolean(errors.guestCount)}
                aria-describedby={errors.guestCount ? 'guestCount-error' : undefined}
                required
              />
              {errors.guestCount && (
                <span className="field-error" id="guestCount-error">
                  {errors.guestCount}
                </span>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="childName">Child name</label>
              <input
                id="childName"
                name="childName"
                type="text"
                value={form.childName}
                onChange={updateField}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="message">Message for Joaquim</label>
            <textarea
              id="message"
              name="message"
              value={form.message}
              onChange={updateField}
              placeholder="Write a sweet birthday wish..."
              rows="4"
              maxLength="220"
              aria-invalid={Boolean(errors.message)}
              aria-describedby="message-helper"
            />
            <span className="helper-text" id="message-helper">
              {form.message.length}/220 characters
            </span>
            {errors.message && <span className="field-error">{errors.message}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="dietaryNotes">Dietary notes or allergies</label>
            <textarea
              id="dietaryNotes"
              name="dietaryNotes"
              value={form.dietaryNotes}
              onChange={updateField}
              placeholder="Optional"
              rows="3"
            />
          </div>

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending RSVP...' : 'Send RSVP'}
          </button>

          {status.message && (
            <div className={`status-message ${status.type}`} role="status">
              {status.message}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <span key={index} style={{ '--delay': `${index * 0.04}s`, '--x': `${(index % 6) - 3}` }} />
      ))}
    </div>
  );
}

function GuestWall({ wishes, onReaction }) {
  return (
    <section className="section wall-section" aria-labelledby="wall-title">
      <div className="section-heading">
        <p className="eyebrow">Birthday wishes</p>
        <h2 id="wall-title">Joaquim&apos;s guest wall</h2>
        <p>Send love, tap an emoji, and make the wall sparkle for the birthday boy.</p>
      </div>

      <div className="wish-grid">
        {wishes.map((wish) => (
          <article className="wish-card" key={wish.id}>
            <div className="wish-header">
              <span className="avatar" aria-hidden="true">
                💙
              </span>
              <div>
                <h3>{wish.guestName || 'Birthday Guest'}</h3>
                <time dateTime={wish.createdAt}>Birthday wish</time>
              </div>
            </div>
            <p>{wish.message}</p>
            <div className="reaction-row" aria-label={`React to ${wish.guestName}'s message`}>
              {REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  onClick={() => onReaction(wish.id, reaction, wish)}
                  aria-label={`React with ${reaction}`}
                >
                  <span>{reaction}</span>
                  <small>{wish.reactionCounts?.[reaction] || 0}</small>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <p>Made with love for Joaquim&apos;s 4th birthday 💙</p>
      <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
        Questions? Contact Sarah on WhatsApp
      </a>
    </footer>
  );
}

export default function App() {
  const [wishes, setWishes] = useState(STARTER_WISHES);
  const [wallNotice, setWallNotice] = useState('');

  const sortedWishes = useMemo(() => {
    return [...wishes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [wishes]);

  useEffect(() => {
    if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_DEPLOYED_SCRIPT_ID')) return;

    const loadRecentMessages = async () => {
      try {
        const response = await fetch(`${SCRIPT_URL}?action=messages&limit=12`);
        const data = await response.json();
        if (data.ok && Array.isArray(data.messages) && data.messages.length) {
          const remoteWishes = data.messages.map((item, index) => ({
            id: `remote-${item.timestamp || index}-${index}`,
            guestName: item.guestName || 'Birthday Guest',
            message: item.message || 'Sent birthday love to Joaquim! 💙',
            reactionCounts: item.reactionCounts || {},
            createdAt: item.timestamp || new Date().toISOString(),
          }));
          setWishes((current) => [...remoteWishes, ...current]);
        }
      } catch {
        // Recent wall messages are optional. The RSVP form still works without this request.
      }
    };

    loadRecentMessages();
  }, []);

  const addWish = (wish) => {
    setWishes((current) => [wish, ...current]);
  };

  const addReaction = async (wishId, reaction, wish) => {
    setWishes((current) =>
      current.map((item) => {
        if (item.id !== wishId) return item;
        const currentCount = item.reactionCounts?.[reaction] || 0;
        return {
          ...item,
          reactionCounts: {
            ...(item.reactionCounts || {}),
            [reaction]: currentCount + 1,
          },
        };
      }),
    );

    setWallNotice('Reaction added!');
    window.setTimeout(() => setWallNotice(''), 1400);

    try {
      await sendToGoogleSheets({
        type: 'reaction',
        guestName: wish.guestName || 'Birthday Guest',
        attendance: '',
        guestCount: '',
        childName: '',
        message: wish.message || '',
        dietaryNotes: '',
        reaction,
      });
    } catch {
      // Reactions stay on the local wall even if the network is unavailable.
    }
  };

  return (
    <main className="app-shell">
      <div className="background-photo" aria-hidden="true" />
      <div className="page-overlay" aria-hidden="true" />
      <FloatingDecorations />
      <MusicControl />

      <div className="content-shell">
        <Hero />
        <RSVPForm onWishAdded={addWish} />
        {wallNotice && <div className="wall-toast">{wallNotice}</div>}
        <GuestWall wishes={sortedWishes} onReaction={addReaction} />
        <Footer />
      </div>
    </main>
  );
}