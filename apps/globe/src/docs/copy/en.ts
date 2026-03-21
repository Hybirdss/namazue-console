import type { DocsCopy } from '../content';

const en: DocsCopy = {
  meta: {
    title: 'Namazue Docs',
    description: 'Product docs for the Namazue earthquake intelligence console.',
  },
  hero: {
    kicker: 'Product Docs',
    title: 'Understand the console before you need to act on it.',
    summary:
      'Namazue turns earthquake activity into a readable operational picture across map context, exposed assets, and decision-focused panels.',
  },
  sections: {
    'what-this-product-does': {
      title: 'What This Product Does',
      body:
        'It reads earthquake activity, organizes the operational picture, and keeps the map and panel interpretation aligned for fast understanding.',
    },
    'core-workflow': {
      title: 'Core Workflow',
      body:
        'An event or scenario becomes active, the console interprets likely consequences, and the user drills into replay, place, and asset context without leaving the main surface.',
    },
    capabilities: {
      title: 'Capabilities',
      body:
        'The docs group capabilities by user purpose so the product reads like a workflow rather than a pile of features.',
    },
    'console-anatomy': {
      title: 'Console Anatomy',
      body:
        'The main screen stays readable by giving each panel one job and keeping the map, checks, and explanations in the same operational frame.',
    },
    'how-to-use-it': {
      title: 'How To Use It',
      body:
        'Start with the current event posture, inspect exposed assets, read the immediate checks, then use replay or scenario shift when you need to compare context.',
    },
    'trust-boundaries': {
      title: 'Trust Boundaries',
      body:
        'Namazue is a decision-support surface. It explains interpreted operational context, but it should not be mistaken for a direct substitute for field confirmation or official warnings.',
    },
    'go-deeper': {
      title: 'Go Deeper',
      body:
        'Use the live console for active reading, the lab surface for internal review, and the technical docs when you need implementation or evidence details.',
    },
  },
  capabilities: {
    'see-the-event': {
      title: 'See The Event',
      summary: 'Read the active event as an operating picture instead of a raw feed item.',
      whyItMatters: 'Operators need the event state and its immediate frame before they can decide what deserves attention.',
      nextAction: 'Open the current event posture and inspect the first-order context on the map.',
    },
    'read-operational-impact': {
      title: 'Read Operational Impact',
      summary: 'Understand how the console reorders assets and checks under the current event.',
      whyItMatters: 'Operational value comes from consequence ordering, not from magnitude alone.',
      nextAction: 'Scan exposed assets and the current action stack together.',
    },
    'explore-replay-and-scenario-shift': {
      title: 'Explore Replay And Scenario Shift',
      summary: 'Compare how the console changes over time and under altered event assumptions.',
      whyItMatters: 'Replay and scenario shift make the reasoning legible when the user needs to compare states.',
      nextAction: 'Use the replay rail or scenario controls to compare how consequences move.',
    },
    'inspect-place-and-asset-context': {
      title: 'Inspect Place And Asset Context',
      summary: 'Move from the general incident picture into specific places, assets, and local context.',
      whyItMatters: 'Users often need to answer a place or asset question without losing the broader incident frame.',
      nextAction: 'Select a place or asset and read the connected local context.',
    },
    'understand-why-the-console-says-this': {
      title: 'Understand Why The Console Says This',
      summary: 'Read compact explanation without turning the product into a chat interface.',
      whyItMatters: 'Trust rises when the surface explains its reasoning in plain operational language.',
      nextAction: 'Read the explanatory notes and related context around the current posture.',
    },
  },
  anatomy: {
    'event-snapshot': {
      title: 'Event Snapshot',
      body: 'Declares what changed in operational terms so the user can orient immediately.',
    },
    'asset-exposure': {
      title: 'Asset Exposure',
      body: 'Orders the affected assets by consequence instead of forcing the user to infer priority.',
    },
    'check-these-now': {
      title: 'Check These Now',
      body: 'Turns the current state into a short list of actions worth reading first.',
    },
    'replay-rail': {
      title: 'Replay Rail',
      body: 'Shows how the console state develops over time so the sequence stays legible.',
    },
  },
};

export default en;
