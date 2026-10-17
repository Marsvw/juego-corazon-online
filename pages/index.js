import Head from 'next/head';
import dynamic from 'next/dynamic';

// The game uses canvas and keyboard APIs, so it only renders in the browser.
const Game = dynamic(() => import('../components/Game.js'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Brainrot Brawl</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="A Smash-style platform fighter with brainrot characters." />
      </Head>
      <Game />
    </>
  );
}
