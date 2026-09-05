import { useState } from 'react';
import { HeroBoard } from '../components/HeroBoard';
import { Link } from '../router';
import './Home.css';

function Arrow() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </svg>
  );
}

const steps = [
  { title: 'Choose a color.', text: 'Take every token of one color from a shared node. The rest move to the center.' },
  { title: 'Complete a row.', text: 'Fill a row to place a token on your memory grid. Connect tokens to score more.' },
  { title: 'Think one move ahead.', text: 'Take what your AI rival needs. Plan carefully: tokens that don’t fit cost points.' },
];

export function Home() {
  const [paused, setPaused] = useState(false);

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-intro">
          <h1 id="home-title">Your mind.<br />An AI rival.<br /><span>Every move matters.</span></h1>
          <p className="home-description">A head-to-head strategy game of color and memory. Build your grid, deny your rival, and make every token count.</p>
          <div className="home-actions">
            <Link to="/daily" className="home-primary">Play today’s challenge <Arrow /></Link>
            <Link to="/practice" className="home-secondary">Practice vs AI</Link>
          </div>
          <p className="home-access">Free to play · No download · No sign-in</p>
        </div>

        <figure className="home-demo" aria-label="Game preview: colored tokens move from shared nodes into rows, then onto a five-by-five memory grid to score points.">
          <div className="home-demo-header">
            <span>MirrorLink <span className="home-demo-label">/ Game preview</span></span>
            <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? 'Resume game preview' : 'Pause game preview'}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                {paused ? <path d="m5 3 8 5-8 5z" /> : <path d="M4 3h3v10H4zm5 0h3v10H9z" />}
              </svg>
              {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <div className="home-board-stage"><HeroBoard paused={paused} /></div>
          <figcaption><span>Choose. Place. Connect.</span><span>A round in motion.</span></figcaption>
        </figure>
      </section>

      <section className="home-how" aria-labelledby="home-how-title">
        <div className="home-section-heading">
          <h2 id="home-how-title">A few rules. Plenty to master.</h2>
          <Link to="/tutorial" className="home-text-link">Learn by playing <Arrow /></Link>
        </div>
        <ol className="home-steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="home-step-number" aria-hidden="true">{index + 1}</span>
              <div><h3>{step.title}</h3><p>{step.text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-about" aria-labelledby="home-about-title">
        <div>
          <h2 id="home-about-title">A familiar game. A different opponent.</h2>
          <p>Inspired by the tile-drafting mechanics of <em>Azul</em>, MirrorLink brings the contest into a world of shared memories and synthetic minds. Face six AI difficulty levels, or return for the daily challenge.</p>
          <a href="/guide/games-like-azul" className="home-text-link">How MirrorLink compares to Azul <Arrow /></a>
        </div>
        <nav aria-label="Game guides" className="home-guides">
          <h3>Explore the game</h3>
          <div>
            {[
              ['/guide/rules', 'Rules of play'],
              ['/guide/scoring', 'Scoring'],
              ['/guide/strategy', 'Strategy'],
              ['/guide/difficulty', 'AI opponents'],
              ['/guide/story', 'The story'],
              ['/guide/faq', 'FAQ'],
            ].map(([href, label]) => <a key={href} href={href}>{label}<Arrow /></a>)}
          </div>
        </nav>
      </section>
    </div>
  );
}
