export interface EducationArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string[];
  references: { label: string; url: string }[];
}

export const EDUCATION_CATEGORIES = [
  'Menstrual cycle basics',
  'Period cramps',
  'PMS',
  'Hygiene',
  'Nutrition',
  'Exercise',
  'Mental wellbeing',
  'When to seek medical help',
];

export const EDUCATION_ARTICLES: EducationArticle[] = [
  {
    id: 'cycle-basics',
    category: 'Menstrual cycle basics',
    title: 'Understanding Your Menstrual Cycle',
    summary:
      'The menstrual cycle is a natural process that prepares the body for pregnancy. Understanding its phases helps you track patterns and anticipate changes.',
    content: [
      'The menstrual cycle typically lasts between 21 and 35 days, with 28 days being an average. It is divided into four main phases: menstrual, follicular, ovulation, and luteal.',
      'The menstrual phase begins on the first day of your period. The uterus sheds its lining, and bleeding typically lasts 3–7 days. This is considered day 1 of a new cycle.',
      'The follicular phase overlaps with menstruation and continues until ovulation. The pituitary gland releases follicle-stimulating hormone (FSH), which causes follicles in the ovaries to mature. The body also produces estrogen, which thickens the uterine lining.',
      'Ovulation occurs around the middle of the cycle, typically 14 days before the next period. A mature egg is released from the ovary and travels through the fallopian tube. This is the most fertile time in the cycle.',
      'The luteal phase follows ovulation and lasts until the next period. The ruptured follicle becomes the corpus luteum, which produces progesterone. If the egg is not fertilized, hormone levels drop, the uterine lining sheds, and a new cycle begins.',
      'Cycle lengths and symptoms vary between individuals and can change over time. Tracking your cycle helps you understand your own patterns.',
    ],
    references: [
      { label: 'ACOG: Menstrual Cycle', url: 'https://www.acog.org/womens-health/faqs/your-first-period-especially-for-teens' },
      { label: 'Office on Women\'s Health', url: 'https://www.womenshealth.gov/menstrual-cycle' },
    ],
  },
  {
    id: 'period-cramps',
    category: 'Period cramps',
    title: 'Managing Period Cramps',
    summary:
      'Menstrual cramps are common and caused by uterine contractions. Understanding what helps can make your period more manageable.',
    content: [
      'Menstrual cramps (dysmenorrhea) are caused by prostaglandins, hormone-like substances that trigger the uterus to contract and shed its lining. Higher prostaglandin levels are associated with stronger cramps.',
      'Primary dysmenorrhea refers to common menstrual cramps without an underlying medical condition. Secondary dysmenorrhea is pain caused by a reproductive health condition such as endometriosis or fibroids.',
      'Things that may help relieve cramps include applying heat to the lower abdomen, gentle exercise or stretching, staying hydrated, and over-the-counter pain relievers such as ibuprofen. Always follow package directions for medications.',
      'Some people find relief with dietary changes such as reducing caffeine, salt, and processed foods, while increasing intake of anti-inflammatory foods like fruits, vegetables, and omega-3-rich fish.',
      'Severe cramps that interfere with daily activities, cramps that suddenly worsen, or pain that doesn\'t respond to typical remedies should be discussed with a healthcare professional. This is not something you have to just live with.',
    ],
    references: [
      { label: 'Mayo Clinic: Menstrual Cramps', url: 'https://www.mayoclinic.org/diseases-conditions/menstrual-cramps/symptoms-causes/syc-20374938' },
      { label: 'ACOG: Dysmenorrhea', url: 'https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods' },
    ],
  },
  {
    id: 'pms',
    category: 'PMS',
    title: 'Premenstrual Syndrome (PMS)',
    summary:
      'PMS affects many people before their period. Knowing the signs and when to seek help can improve your quality of life.',
    content: [
      'Premenstrual Syndrome (PMS) refers to physical and emotional symptoms that occur in the days or weeks before a period. Symptoms typically resolve shortly after menstruation begins.',
      'Common physical symptoms include bloating, breast tenderness, fatigue, headaches, and changes in appetite. Emotional symptoms can include mood swings, irritability, anxiety, sadness, and difficulty concentrating.',
      'PMS is linked to the hormonal changes during the luteal phase. The exact cause is not fully understood, but fluctuations in estrogen and progesterone play a role.',
      'Lifestyle approaches that may help include regular exercise, a balanced diet, adequate sleep, stress management, and limiting caffeine and alcohol. Some people find tracking symptoms helps them anticipate and manage difficult days.',
      'Premenstrual Dysphoric Disorder (PMDD) is a more severe form of PMS that causes significant emotional distress and interferes with daily life. If your premenstrual symptoms are severe, persistent, or affect your relationships or ability to function, consider speaking with a healthcare professional. PMDD is treatable.',
    ],
    references: [
      { label: 'Office on Women\'s Health: PMS', url: 'https://www.womenshealth.gov/menstrual-cycle/premenstrual-syndrome' },
      { label: 'Mayo Clinic: PMDD', url: 'https://www.mayoclinic.org/diseases-conditions/premenstrual-dysphoric-disorder/symptoms-causes/syc-20379918' },
    ],
  },
  {
    id: 'hygiene',
    category: 'Hygiene',
    title: 'Menstrual Hygiene Basics',
    summary:
      'Good menstrual hygiene helps prevent infections and keeps you comfortable during your period.',
    content: [
      'Changing menstrual products regularly is essential. Pads should be changed every 3–4 hours, tampons every 4–6 hours, and menstrual cups every 8–12 hours. Leaving tampons in too long can increase the risk of Toxic Shock Syndrome (TSS), a rare but serious condition.',
      'Always wash your hands before and after changing menstrual products. Clean the external genital area with mild soap and water. Avoid using scented products, douches, or harsh soaps in the genital area, as these can disrupt the natural balance and cause irritation.',
      'Menstrual cups should be sterilized between periods. Reusable cloth pads should be washed thoroughly with soap and dried in sunlight if possible.',
      'Proper disposal of used products is important. Wrap used pads and tampons in tissue or the wrapper before disposing in a bin. Do not flush them down the toilet, as they can cause plumbing problems.',
      'If you experience unusual odor, persistent itching, burning, or unusual discharge, consider speaking with a healthcare professional. These may be signs of an infection that requires treatment.',
    ],
    references: [
      { label: 'WHO: Menstrual Hygiene', url: 'https://www.who.int/health-topics/menstrual-hygiene' },
      { label: 'UNICEF: Menstrual Hygiene Management', url: 'https://www.unicef.org/wash/menstrual-hygiene-management' },
    ],
  },
  {
    id: 'nutrition',
    category: 'Nutrition',
    title: 'Nutrition and Your Cycle',
    summary:
      'What you eat can affect how you feel during your cycle. Certain nutrients may help manage common symptoms.',
    content: [
      'Iron is important during your period because blood loss can deplete iron levels. Iron-rich foods include leafy greens (spinach, kale), beans, lentils, fortified cereals, and lean meat. Pairing iron-rich foods with vitamin C (citrus, bell peppers) can improve absorption.',
      'Magnesium may help reduce cramps and mood changes. Good sources include nuts (almonds, cashews), seeds (pumpkin, sunflower), dark chocolate, whole grains, and leafy greens.',
      'Calcium and vitamin D support hormonal health. Dairy products, fortified plant milks, tofu, and leafy greens are good sources of calcium. Sunlight exposure and fortified foods provide vitamin D.',
      'Staying hydrated helps reduce bloating and water retention. Aim for at least 8 glasses of water per day. Herbal teas like ginger or chamomile may also help with symptoms.',
      'Limiting caffeine, alcohol, excess salt, and highly processed foods may reduce PMS symptoms and bloating. Eating regular, balanced meals helps maintain stable blood sugar and energy levels.',
      'If you are considering dietary supplements, speak with a healthcare professional first, as individual needs vary and some supplements can interact with medications.',
    ],
    references: [
      { label: 'Harvard Health: Diet and PMS', url: 'https://www.health.harvard.edu/blog' },
      { label: 'Academy of Nutrition and Dietetics', url: 'https://www.eatright.org/' },
    ],
  },
  {
    id: 'exercise',
    category: 'Exercise',
    title: 'Exercise During Your Period',
    summary:
      'Staying active during your cycle can help manage symptoms. The key is listening to your body.',
    content: [
      'Exercise can help relieve menstrual symptoms by increasing blood flow, releasing endorphins (natural pain relievers), and improving mood. It can also help reduce bloating and fatigue.',
      'During the menstrual phase, gentle activities like walking, light yoga, and stretching are often most comfortable. Some people prefer to rest more during the first few days of their period.',
      'During the follicular and ovulation phases, energy levels may be higher, making it a good time for more intense activities like running, strength training, or high-intensity workouts.',
      'During the luteal phase, you may feel more fatigued. Moderate activities like swimming, cycling, and pilates can be good choices. There is no evidence that exercising during your period is harmful.',
      'Listen to your body. If you feel very tired or are in significant pain, it is okay to rest. Pushing through severe pain is not necessary and may not be helpful.',
      'If you experience pain during exercise that is unusual for you, or if exercise triggers symptoms that concern you, consider speaking with a healthcare professional.',
    ],
    references: [
      { label: 'ACSM: Exercise and Menstruation', url: 'https://www.acsm.org/' },
      { label: 'Office on Women\'s Health: Physical Activity', url: 'https://www.womenshealth.gov/fitness-and-nutrition' },
    ],
  },
  {
    id: 'mental-wellbeing',
    category: 'Mental wellbeing',
    title: 'Mental Wellbeing and Your Cycle',
    summary:
      'Hormonal changes can affect mood and mental health. Recognizing the connection is an important part of self-care.',
    content: [
      'Hormonal fluctuations throughout the menstrual cycle can affect mood, energy, and mental wellbeing. It is common to experience mood changes, irritability, anxiety, or sadness, especially during the luteal phase (the days before your period).',
      'Tracking your mood alongside your cycle can help you identify patterns. Knowing when to expect difficult days can help you plan self-care and communicate with people around you.',
      'Self-care strategies that support mental wellbeing include getting enough sleep (7–9 hours), regular physical activity, mindfulness or meditation, spending time with supportive people, and being gentle with yourself during difficult days.',
      'Premenstrual Dysphoric Disorder (PMDD) is a severe form of PMS that causes significant emotional distress. If your premenstrual symptoms cause severe anxiety, depression, or affect your ability to function, consider speaking with a healthcare professional.',
      'If you experience persistent feelings of sadness, hopelessness, or anxiety that last beyond your period, or if you have thoughts of self-harm, please reach out to a mental health professional or a crisis line immediately. Help is available.',
    ],
    references: [
      { label: 'NIMH: Women\'s Mental Health', url: 'https://www.nimh.nih.gov/health/topics/women-and-mental-health' },
      { label: 'Office on Women\'s Health: Mental Health', url: 'https://www.womenshealth.gov/mental-health' },
    ],
  },
  {
    id: 'when-to-seek-help',
    category: 'When to seek medical help',
    title: 'When to Seek Medical Help',
    summary:
      'Knowing when to consult a healthcare professional is an important part of managing your menstrual health.',
    content: [
      'It is important to know when to seek medical advice. While some variation in your cycle is normal, certain symptoms warrant professional attention.',
      'Consider speaking with a healthcare professional if you experience: periods that are consistently shorter than 21 days or longer than 35 days; bleeding that lasts more than 7 days; very heavy bleeding (soaking through a pad or tampon every hour for several hours); severe pain that disrupts daily activities; bleeding between periods or after menopause; missing periods for 3 or more months (if not pregnant); sudden changes in your cycle; or symptoms that significantly affect your quality of life.',
      'Conditions that can affect menstrual health include endometriosis, polycystic ovary syndrome (PCOS), fibroids, thyroid disorders, and others. These require professional diagnosis and management. Do not attempt to self-diagnose based on symptoms alone.',
      'If you believe you are experiencing a medical emergency, contact your local emergency services or seek immediate medical care. This includes severe, sudden pain; excessive bleeding; fainting; or signs of Toxic Shock Syndrome (high fever, rash, low blood pressure).',
      'Remember: seeking help is a sign of taking care of yourself, not weakness. You deserve to feel your best, and healthcare professionals are there to support you.',
    ],
    references: [
      { label: 'ACOG: When to See a Doctor', url: 'https://www.acog.org/womens-health' },
      { label: 'Mayo Clinic: Menstrual Problems', url: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186' },
    ],
  },
];
