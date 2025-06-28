const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { MockElement, MockDocument } = require('./mockDom');

function createResonant() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'resonant.js'), 'utf8');
  const context = { console, setTimeout, clearTimeout };
  context.window = context;
  context.document = { querySelectorAll: () => [] };

  const store = {};
  context.localStorage = {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = val; },
    removeItem: key => { delete store[key]; }
  };

  vm.createContext(context);
  vm.runInContext(code, context);
  const Resonant = vm.runInContext('Resonant', context);
  return { context, resonant: new Resonant(), store };
}

function createResonantDom(root) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'resonant.js'), 'utf8');
  const context = { console, setTimeout, clearTimeout };
  context.window = context;
  context.document = new MockDocument(root);
  const store = {};
  context.localStorage = {
    getItem: key => (key in store ? store[key] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: k => { delete store[k]; }
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  const Resonant = vm.runInContext('Resonant', context);
  return { context, resonant: new Resonant(), root };
}

// Test 4-level deep object nesting
test('4-level deep object property updates trigger callbacks', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const deepObject = {
    level1: {
      level2: {
        level3: {
          level4: 'initial value'
        }
      }
    }
  };
  
  resonant.add('deepObj', deepObject);
  resonant.addCallback('deepObj', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Modify the deepest level
  context.deepObj.level1.level2.level3.level4 = 'updated value';
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.deepObj.level1.level2.level3.level4, 'updated value');
  assert.strictEqual(resonant.data.deepObj.level1.level2.level3.level4, 'updated value');
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test deep object within array
test('objects within arrays with deep nesting trigger updates', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const nestedArray = [
    {
      id: 1,
      profile: {
        personal: {
          contact: {
            email: 'user1@example.com',
            phone: '123-456-7890'
          }
        }
      }
    },
    {
      id: 2,
      profile: {
        personal: {
          contact: {
            email: 'user2@example.com',
            phone: '987-654-3210'
          }
        }
      }
    }
  ];
  
  resonant.add('users', nestedArray);
  resonant.addCallback('users', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Update deep property in first array item
  context.users[0].profile.personal.contact.email = 'newemail@example.com';
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.users[0].profile.personal.contact.email, 'newemail@example.com');
  assert.strictEqual(callbackResult.action, 'modified');
  // Verify the callback was triggered 
  assert(callbackResult.item !== undefined, 'Callback item should be defined');
});

// Test adding new deep nested object to array
test('adding objects with deep nesting to arrays works correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  resonant.add('complexUsers', []);
  resonant.addCallback('complexUsers', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  const newUser = {
    id: 3,
    data: {
      profile: {
        settings: {
          preferences: {
            theme: 'dark',
            notifications: {
              email: true,
              push: false,
              sms: true
            }
          }
        }
      }
    }
  };
  
  context.complexUsers.push(newUser);
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.complexUsers.length, 1);
  assert.strictEqual(context.complexUsers[0].data.profile.settings.preferences.theme, 'dark');
  assert.strictEqual(context.complexUsers[0].data.profile.settings.preferences.notifications.email, true);
  assert.strictEqual(callbackResult.action, 'added');
});

// Test removing nested objects from array
test('removing objects with deep nesting from arrays triggers correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const complexData = [
    {
      id: 1,
      nested: { deep: { deeper: { value: 'keep' } } }
    },
    {
      id: 2,
      nested: { deep: { deeper: { value: 'remove' } } }
    }
  ];
  
  resonant.add('complexData', complexData);
  resonant.addCallback('complexData', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  context.complexData.delete(1);
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.complexData.length, 1);
  assert.strictEqual(context.complexData[0].nested.deep.deeper.value, 'keep');
  assert.strictEqual(callbackResult.action, 'removed');
  assert.strictEqual(callbackResult.item.id, 2);
});

// Test array within deep nested object
test('arrays within deeply nested objects trigger updates', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const objectWithNestedArray = {
    company: {
      departments: {
        engineering: {
          teams: {
            frontend: {
              members: ['Alice', 'Bob']
            }
          }
        }
      }
    }
  };
  
  resonant.add('organization', objectWithNestedArray);
  resonant.addCallback('organization', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Add member to deeply nested array
  context.organization.company.departments.engineering.teams.frontend.members.push('Charlie');
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.organization.company.departments.engineering.teams.frontend.members.length, 3);
  assert.strictEqual(context.organization.company.departments.engineering.teams.frontend.members[2], 'Charlie');
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test complex nested structure without circular references
test('complex nested structure with multiple object types works correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const complexObj = {
    level1: {
      level2: {
        level3: {
          value: 'test',
          metadata: {
            created: '2023-01-01',
            tags: ['important', 'nested']
          }
        }
      }
    }
  };
  
  resonant.add('complexObj', complexObj);
  resonant.addCallback('complexObj', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Should work normally
  assert.strictEqual(context.complexObj.level1.level2.level3.value, 'test');
  
  // Update deep nested array
  context.complexObj.level1.level2.level3.metadata.tags.push('updated');
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.complexObj.level1.level2.level3.metadata.tags.length, 3);
  assert.strictEqual(context.complexObj.level1.level2.level3.metadata.tags[2], 'updated');
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test mixed arrays and objects with deep nesting
test('mixed arrays and objects with deep nesting work correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const mixedStructure = {
    projects: [
      {
        name: 'Project A',
        tasks: [
          {
            id: 1,
            details: {
              assignee: {
                profile: {
                  name: 'John',
                  skills: ['JavaScript', 'React']
                }
              }
            }
          }
        ]
      }
    ]
  };
  
  resonant.add('workspace', mixedStructure);
  resonant.addCallback('workspace', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Add skill to deeply nested array within object within array within object
  context.workspace.projects[0].tasks[0].details.assignee.profile.skills.push('TypeScript');
  await new Promise(r => setTimeout(r, 5));
  
  const skills = context.workspace.projects[0].tasks[0].details.assignee.profile.skills;
  assert.strictEqual(skills.length, 3);
  assert.strictEqual(skills[2], 'TypeScript');
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test deep nesting with DOM updates
test('deep nested objects update DOM correctly', async () => {
  const container = new MockElement('div');
  container.setAttribute('res', 'deepData');
  
  const level1Div = new MockElement('div');
  level1Div.setAttribute('res-prop', 'level1');
  
  const level2Div = new MockElement('div');
  level2Div.setAttribute('res-prop', 'level2');
  
  const level3Span = new MockElement('span');
  level3Span.setAttribute('res-prop', 'level3');
  
  const valueSpan = new MockElement('span');
  valueSpan.setAttribute('res-prop', 'value');
  
  level3Span.appendChild(valueSpan);
  level2Div.appendChild(level3Span);
  level1Div.appendChild(level2Div);
  container.appendChild(level1Div);
  
  const root = new MockElement('div');
  root.appendChild(container);

  const { context, resonant } = createResonantDom(root);
  
  const deepStructure = {
    level1: {
      level2: {
        level3: {
          value: 'initial DOM value'
        }
      }
    }
  };
  
  resonant.add('deepData', deepStructure);
  
  assert.strictEqual(valueSpan.innerHTML, 'initial DOM value');
  
  // Update deep value
  context.deepData.level1.level2.level3.value = 'updated DOM value';
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(valueSpan.innerHTML, 'updated DOM value');
});

// Test performance with very deep nesting
test('very deep nesting (10 levels) works without performance issues', async () => {
  const { context, resonant } = createResonant();
  
  // Create 10-level deep object
  let deepObj = {};
  let current = deepObj;
  for (let i = 1; i <= 10; i++) {
    current[`level${i}`] = {};
    if (i === 10) {
      current[`level${i}`].finalValue = 'deep value';
    } else {
      current = current[`level${i}`];
    }
  }
  
  const startTime = Date.now();
  resonant.add('veryDeepObj', deepObj);
  const addTime = Date.now() - startTime;
  
  // Should complete quickly (less than 100ms)
  assert(addTime < 100, `Adding deep object took too long: ${addTime}ms`);
  
  // Verify deep value is accessible and modifiable
  assert.strictEqual(context.veryDeepObj.level1.level2.level3.level4.level5.level6.level7.level8.level9.level10.finalValue, 'deep value');
  
  const updateStart = Date.now();
  context.veryDeepObj.level1.level2.level3.level4.level5.level6.level7.level8.level9.level10.finalValue = 'updated deep value';
  const updateTime = Date.now() - updateStart;
  
  await new Promise(r => setTimeout(r, 5));
  
  // Update should also complete quickly
  assert(updateTime < 50, `Updating deep value took too long: ${updateTime}ms`);
  assert.strictEqual(context.veryDeepObj.level1.level2.level3.level4.level5.level6.level7.level8.level9.level10.finalValue, 'updated deep value');
});

// Test deep persistence
test('deeply nested objects persist correctly to localStorage', async () => {
  const { context, resonant, store } = createResonant();
  
  const complexPersistentData = {
    application: {
      user: {
        profile: {
          settings: {
            appearance: {
              theme: 'dark',
              colors: {
                primary: '#007acc',
                secondary: '#ff6b6b'
              }
            }
          }
        }
      }
    }
  };
  
  resonant.add('appData', complexPersistentData, true);
  
  // Verify initial persistence
  const stored = JSON.parse(store['res_appData']);
  assert.strictEqual(stored.application.user.profile.settings.appearance.theme, 'dark');
  
  // Update deep property
  context.appData.application.user.profile.settings.appearance.colors.primary = '#ff0000';
  await new Promise(r => setTimeout(r, 5));
  
  // Verify persistence after update
  const updatedStored = JSON.parse(store['res_appData']);
  assert.strictEqual(updatedStored.application.user.profile.settings.appearance.colors.primary, '#ff0000');
  assert.strictEqual(updatedStored.application.user.profile.settings.appearance.colors.secondary, '#ff6b6b'); // unchanged
});

// Test object arrays inside object arrays
test('object arrays nested within other object arrays update correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const nestedObjectArrays = [
    {
      id: 1,
      name: 'Department A',
      teams: [
        {
          teamId: 'team1',
          teamName: 'Frontend',
          members: [
            { memberId: 1, name: 'Alice', role: 'Developer' },
            { memberId: 2, name: 'Bob', role: 'Designer' }
          ]
        },
        {
          teamId: 'team2',
          teamName: 'Backend',
          members: [
            { memberId: 3, name: 'Charlie', role: 'Developer' },
            { memberId: 4, name: 'Diana', role: 'DevOps' }
          ]
        }
      ]
    },
    {
      id: 2,
      name: 'Department B',
      teams: [
        {
          teamId: 'team3',
          teamName: 'Marketing',
          members: [
            { memberId: 5, name: 'Eve', role: 'Manager' }
          ]
        }
      ]
    }
  ];
  
  resonant.add('departments', nestedObjectArrays);
  resonant.addCallback('departments', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Update a member's name in the nested array structure
  context.departments[0].teams[1].members[0].name = 'Charles';
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.departments[0].teams[1].members[0].name, 'Charles');
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test adding objects to nested object arrays
test('adding objects to nested object arrays triggers updates correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const schoolData = [
    {
      schoolId: 1,
      name: 'Elementary School',
      classes: [
        {
          classId: 'class1',
          grade: '3rd',
          students: [
            { studentId: 1, name: 'Tommy', age: 8 }
          ]
        }
      ]
    }
  ];
  
  resonant.add('schools', schoolData);
  resonant.addCallback('schools', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Add a new student to the nested students array
  context.schools[0].classes[0].students.push({ studentId: 2, name: 'Sarah', age: 9 });
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.schools[0].classes[0].students.length, 2);
  assert.strictEqual(context.schools[0].classes[0].students[1].name, 'Sarah');
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test removing objects from nested object arrays
test('removing objects from nested object arrays triggers updates correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const companyData = [
    {
      companyId: 1,
      name: 'Tech Corp',
      offices: [
        {
          officeId: 'office1',
          location: 'New York',
          employees: [
            { empId: 1, name: 'John', department: 'Engineering' },
            { empId: 2, name: 'Jane', department: 'Marketing' },
            { empId: 3, name: 'Jim', department: 'Sales' }
          ]
        },
        {
          officeId: 'office2',
          location: 'San Francisco',
          employees: [
            { empId: 4, name: 'Jake', department: 'Engineering' }
          ]
        }
      ]
    }
  ];
  
  resonant.add('companies', companyData);
  resonant.addCallback('companies', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Remove an employee from the nested employees array
  context.companies[0].offices[0].employees.splice(1, 1); // Remove Jane
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.companies[0].offices[0].employees.length, 2);
  assert.strictEqual(context.companies[0].offices[0].employees[0].name, 'John');
  assert.strictEqual(context.companies[0].offices[0].employees[1].name, 'Jim');
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test adding entire object arrays to parent arrays
test('adding entire object arrays to parent arrays works correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const ecommerceData = [
    {
      categoryId: 1,
      name: 'Electronics',
      products: [
        {
          productId: 1,
          name: 'Laptop',
          reviews: [
            { reviewId: 1, rating: 5, comment: 'Great!' }
          ]
        }
      ]
    }
  ];
  
  resonant.add('categories', ecommerceData);
  resonant.addCallback('categories', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Add a new product with its own reviews array
  const newProduct = {
    productId: 2,
    name: 'Phone',
    reviews: [
      { reviewId: 2, rating: 4, comment: 'Good' },
      { reviewId: 3, rating: 5, comment: 'Excellent!' }
    ]
  };
  
  context.categories[0].products.push(newProduct);
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.categories[0].products.length, 2);
  assert.strictEqual(context.categories[0].products[1].name, 'Phone');
  assert.strictEqual(context.categories[0].products[1].reviews.length, 2);
  assert.strictEqual(context.categories[0].products[1].reviews[1].comment, 'Excellent!');
  assert.strictEqual(callbackResult.action, 'modified');
});

// Test 3-level nested object arrays
test('3-level nested object arrays work correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const gameData = [
    {
      gameId: 1,
      title: 'RPG Game',
      worlds: [
        {
          worldId: 1,
          name: 'Forest World',
          levels: [
            {
              levelId: 1,
              name: 'Forest Level 1',
              enemies: [
                { enemyId: 1, type: 'Orc', health: 100 },
                { enemyId: 2, type: 'Goblin', health: 50 }
              ]
            },
            {
              levelId: 2,
              name: 'Forest Level 2',
              enemies: [
                { enemyId: 3, type: 'Dragon', health: 500 }
              ]
            }
          ]
        }
      ]
    }
  ];
  
  resonant.add('games', gameData);
  resonant.addCallback('games', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Update enemy health in 3-level nested structure
  context.games[0].worlds[0].levels[1].enemies[0].health = 450;
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.games[0].worlds[0].levels[1].enemies[0].health, 450);
  assert.strictEqual(callbackResult.action, 'modified');
  
  // Add new enemy to deeply nested array
  context.games[0].worlds[0].levels[0].enemies.push({ enemyId: 4, type: 'Troll', health: 200 });
  await new Promise(r => setTimeout(r, 5));
  
  assert.strictEqual(context.games[0].worlds[0].levels[0].enemies.length, 3);
  assert.strictEqual(context.games[0].worlds[0].levels[0].enemies[2].type, 'Troll');
});

// Test nested object arrays with simple DOM updates
test('nested object arrays update DOM correctly', async () => {
  const ul = new MockElement('ul');
  const li = new MockElement('li');
  li.setAttribute('res', 'teams');
  
  const nameSpan = new MockElement('span');
  nameSpan.setAttribute('res-prop', 'name');
  
  const membersUl = new MockElement('ul');
  const memberLi = new MockElement('li');
  memberLi.setAttribute('res-prop', 'members');
  
  const memberNameSpan = new MockElement('span');
  memberNameSpan.setAttribute('res-prop', 'name');
  
  memberLi.appendChild(memberNameSpan);
  membersUl.appendChild(memberLi);
  li.appendChild(nameSpan);
  li.appendChild(membersUl);
  ul.appendChild(li);
  
  const root = new MockElement('div');
  root.appendChild(ul);

  const { context, resonant } = createResonantDom(root);
  
  const teamStructure = [
    {
      teamId: 1,
      name: 'Development Team',
      members: [
        { memberId: 1, name: 'Alice' },
        { memberId: 2, name: 'Bob' }
      ]
    }
  ];
  
  resonant.add('teams', teamStructure);
  
  // Verify initial DOM state
  const renderedTeams = ul.querySelectorAll('[res-rendered="true"]');
  assert.strictEqual(renderedTeams[0].querySelector('[res-prop="name"]').innerHTML, 'Development Team');
  
  // Update member name in nested array
  context.teams[0].members[0].name = 'Alice Updated';
  await new Promise(r => setTimeout(r, 5));
  
  // Verify the nested member name was updated in DOM
  const updatedTeams = ul.querySelectorAll('[res-rendered="true"]');
  const memberElements = updatedTeams[0].querySelectorAll('[res-prop="members"][res-rendered="true"]');
  assert.strictEqual(memberElements[0].querySelector('[res-prop="name"]').innerHTML, 'Alice Updated');
});

// Test performance with large nested object arrays
test('large nested object arrays perform well', async () => {
  const { context, resonant } = createResonant();
  
  // Create large nested structure
  const largeNestedData = [];
  for (let i = 0; i < 10; i++) {
    const department = {
      deptId: i,
      name: `Department ${i}`,
      teams: []
    };
    
    for (let j = 0; j < 5; j++) {
      const team = {
        teamId: `${i}-${j}`,
        name: `Team ${j}`,
        members: []
      };
      
      for (let k = 0; k < 10; k++) {
        team.members.push({
          memberId: `${i}-${j}-${k}`,
          name: `Member ${k}`,
          skills: [`Skill${k}A`, `Skill${k}B`]
        });
      }
      
      department.teams.push(team);
    }
    
    largeNestedData.push(department);
  }
  
  const startTime = Date.now();
  resonant.add('largeNestedData', largeNestedData);
  const addTime = Date.now() - startTime;
  
  // Should complete quickly (less than 200ms for this large structure)
  assert(addTime < 200, `Adding large nested structure took too long: ${addTime}ms`);
  
  // Verify structure integrity
  assert.strictEqual(context.largeNestedData.length, 10);
  assert.strictEqual(context.largeNestedData[5].teams.length, 5);
  assert.strictEqual(context.largeNestedData[5].teams[3].members.length, 10);
  assert.strictEqual(context.largeNestedData[5].teams[3].members[7].name, 'Member 7');
  
  // Test update performance
  const updateStart = Date.now();
  context.largeNestedData[5].teams[3].members[7].name = 'Updated Member 7';
  const updateTime = Date.now() - updateStart;
  
  await new Promise(r => setTimeout(r, 5));
  
  assert(updateTime < 50, `Updating nested value took too long: ${updateTime}ms`);
  assert.strictEqual(context.largeNestedData[5].teams[3].members[7].name, 'Updated Member 7');
});

// Test nested object arrays with mixed data types
test('nested object arrays with mixed data types work correctly', async () => {
  const { context, resonant } = createResonant();
  let callbackResult;
  
  const mixedData = [
    {
      id: 1,
      name: 'Project Alpha',
      metadata: {
        created: '2023-01-01',
        active: true,
        priority: 5
      },
      tasks: [
        {
          taskId: 1,
          title: 'Setup',
          completed: false,
          assignees: [
            { userId: 1, name: 'John', active: true },
            { userId: 2, name: 'Jane', active: false }
          ],
          tags: ['setup', 'initial'],
          progress: {
            percentage: 25,
            milestones: [
              { id: 1, name: 'Start', completed: true },
              { id: 2, name: 'Middle', completed: false }
            ]
          }
        }
      ]
    }
  ];
  
  resonant.add('projects', mixedData);
  resonant.addCallback('projects', (newVal, item, action) => {
    callbackResult = { newVal, item, action };
  });
  
  // Update various nested properties of different types
  context.projects[0].metadata.priority = 8;
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.projects[0].metadata.priority, 8);
  
  context.projects[0].tasks[0].completed = true;
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.projects[0].tasks[0].completed, true);
  
  context.projects[0].tasks[0].assignees[1].active = true;
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.projects[0].tasks[0].assignees[1].active, true);
  
  context.projects[0].tasks[0].tags.push('in-progress');
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.projects[0].tasks[0].tags.length, 3);
  
  context.projects[0].tasks[0].progress.milestones[1].completed = true;
  await new Promise(r => setTimeout(r, 5));
  assert.strictEqual(context.projects[0].tasks[0].progress.milestones[1].completed, true);
  
  assert.strictEqual(callbackResult.action, 'modified');
});