function getRandomPerson() {
  let people = [
    'jr',
    'jr',
    'jr',
    'jr',
    'jr',
    'jr',
    'brandon',
    'brandon',
    'brandon',
    'brandon',
    'brandon',
    'rick',
    'rick',
    'rick',
    'rick',
    'rick',
    'robbie',
    'robbie',
    'robbie',
    'robbie',
    'robbie',
    'robbie',
    'robbie',
    'whorne',
    'whorne',
    'whorne',
    'whorne',
    'pat o',
    'pat o',
    'pat o',
    'sheridan',
  ];

  const top3 = [];
  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(Math.random() * people.length);
    const randomPerson = people[randomIndex];
    top3.push(randomPerson);
    people = people.filter((x) => x !== randomPerson);
  }

  console.log(top3);
}

getRandomPerson();
