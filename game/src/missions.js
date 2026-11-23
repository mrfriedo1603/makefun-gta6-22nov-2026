// Solmar Bay — story missions, objectives and rewards.
// Five jobs from fixer Mara Solis. Each mission is a list of steps; a step
// completes when the player reaches its marker (or does its action), then
// the next step starts. Finishing a mission pays cash and unlocks the next.

export const MISSIONS = [
  {
    id: 1,
    title: 'First Job',
    giver: 'Mara Solis',
    briefing: "Danny, welcome back. A client left a package at the docks. Pick it up and bring it to my office. Keep it clean — and keep the car.",
    reward: 250,
    grantPistol: true,
    steps: [
      { type: 'goto', x: 350, y: 2050, radius: 70, text: 'Pick up the package at the Docks' },
      { type: 'goto', x: 1250, y: 950, radius: 70, text: 'Deliver the package to Mara\'s Office' },
    ],
  },
  {
    id: 2,
    title: 'Taxi Trouble',
    giver: 'Mara Solis',
    briefing: 'A rival crew is skimming our taxi fares. Steal a taxi — any taxi — and work the Downtown loop. Three fares and we call it even.',
    reward: 400,
    steps: [
      { type: 'steal', carType: 'taxi', radius: 0, text: 'Steal a taxi' },
      { type: 'fare', x: 1400, y: 1100, radius: 60, text: 'Drop off fare 1 — Downtown' },
      { type: 'fare', x: 1850, y: 650, radius: 60, text: 'Drop off fare 2 — Palms Casino' },
      { type: 'fare', x: 650, y: 650, radius: 60, text: 'Drop off fare 3 — Safehouse' },
    ],
  },
  {
    id: 3,
    title: 'Hot Wheels',
    giver: 'Mara Solis',
    briefing: 'The cops are sniffing around the docks job. Lose them — get to 3 stars, then shake every last one and reach the Safehouse. Do not get busted.',
    reward: 600,
    steps: [
      { type: 'wanted', stars: 3, text: 'Raise heat to 3 stars' },
      { type: 'escape', x: 650, y: 650, radius: 80, text: 'Lose the cops, reach the Safehouse' },
    ],
  },
  {
    id: 4,
    title: 'The Drop',
    giver: 'Mara Solis',
    briefing: 'A buyer at the Marina wants the goods tonight. The route is hot — the cops will be on you the moment you move. Deliver it anyway.',
    reward: 900,
    steps: [
      { type: 'goto', x: 350, y: 2050, radius: 70, text: 'Collect the goods at the Docks' },
      { type: 'goto', x: 2050, y: 1950, radius: 80, text: 'Deliver to the Marina buyer — stay moving' },
    ],
  },
  {
    id: 5,
    title: 'The Big Score',
    giver: 'Mara Solis',
    briefing: 'This is the one, Danny. Bay Bank, midday, four stars of heat and a straight run to the Safehouse. Pull it off and we are made.',
    reward: 2500,
    steps: [
      { type: 'goto', x: 1550, y: 1250, radius: 70, text: 'Hit Bay Bank' },
      { type: 'grab', x: 1550, y: 1250, radius: 70, text: 'Grab the cash (hold the vault)' },
      { type: 'escape', x: 650, y: 650, radius: 90, text: 'Escape to the Safehouse with the cash' },
    ],
  },
];

export function startMission(state, id) {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) return null;
  return {
    def,
    stepIndex: 0,
    stepT: 0,
    holdT: 0,
    fareCount: 0,
    done: false,
  };
}

export function currentStep(mission) {
  return mission.def.steps[mission.stepIndex];
}

export function missionObjective(mission) {
  if (!mission) return '';
  const step = currentStep(mission);
  if (!step) return '';
  return `${mission.def.title}: ${step.text}`;
}

// Advance the mission machine. Returns an event string when something
// notable happens ('step', 'complete', 'failed'), else null.
export function updateMission(state, dt) {
  const mission = state.mission;
  if (!mission || mission.done) return null;
  const step = currentStep(mission);
  if (!step) return null;
  mission.stepT += dt;
  const p = state.player;

  const distTo = (x, y) => Math.hypot(p.x - x, p.y - y);

  switch (step.type) {
    case 'goto':
    case 'fare': {
      if (distTo(step.x, step.y) < step.radius) return advance(state);
      break;
    }
    case 'steal': {
      if (p.inCar && p.car && p.car.type === step.carType) return advance(state);
      break;
    }
    case 'wanted': {
      if (state.wanted >= step.stars) return advance(state);
      break;
    }
    case 'escape': {
      // Reach the marker only once the heat is down.
      if (state.wanted === 0 && distTo(step.x, step.y) < step.radius) return advance(state);
      break;
    }
    case 'grab': {
      if (distTo(step.x, step.y) < step.radius) {
        mission.holdT += dt;
        if (mission.holdT > 3) return advance(state);
      } else {
        mission.holdT = 0;
      }
      break;
    }
    default:
      break;
  }
  return null;
}

function advance(state) {
  const mission = state.mission;
  mission.stepIndex++;
  mission.stepT = 0;
  mission.holdT = 0;
  if (mission.stepIndex >= mission.def.steps.length) {
    mission.done = true;
    state.cash += mission.def.reward;
    state.completedMissions.push(mission.def.id);
    if (mission.def.grantPistol) state.player.hasPistol = true;
    return 'complete';
  }
  return 'step';
}

// Where should the mission marker point right now?
export function missionTarget(state) {
  const mission = state.mission;
  if (!mission || mission.done) return null;
  const step = currentStep(mission);
  if (!step || step.x === undefined) return null;
  return { x: step.x, y: step.y, radius: step.radius || 70 };
}
