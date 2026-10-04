import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  GraduationCap,
  Headphones,
  Languages,
  Mic,
  MonitorCheck,
  PenTool,
  Stethoscope,
} from "lucide-react";

import type { CourseSlug } from "./courses";

export type ModuleDetail = {
  title: string;
  duration: string;
  itemsCount: string;
  description: string;
  focusSkills: string[];
  icon: LucideIcon;
};

export type ProTip = {
  title: string;
  body: string;
  tag: string;
};

export type CoursePresentation = {
  slug: CourseSlug;
  title: string;
  tagline: string;
  badge: string;
  heroKicker: string;
  heroHeadline: string;
  heroDescription: string;
  benchmarkTarget: string;
  examDuration: string;
  examFormat: string;
  examCouncil: string;
  accentColor: string;
  accentSoft: string;
  accentInk: string;
  gradientBackground: string;
  cardGlow: string;
  icon: LucideIcon;
  modules: ModuleDetail[];
  proTips: ProTip[];
  testSizes: {
    size: 20 | 50 | 100;
    label: string;
    durationEst: string;
    recommendation: string;
  }[];
};

export const coursePresentations: Record<CourseSlug, CoursePresentation> = {
  ielts: {
    slug: "ielts",
    title: "IELTS Academic & General",
    tagline: "International English Language Testing System",
    badge: "British Council & IDP Aligned",
    heroKicker: "Curriculum Track 01",
    heroHeadline: "Master the Global Benchmark for Higher Education & Migration",
    heroDescription:
      "Comprehensive preparation engineered for ambitious candidates targeting Band 7.5 and above. Access verified high-yield study materials and randomized mock exam simulations.",
    benchmarkTarget: "Band 7.5 – 9.0 Target",
    examDuration: "2 Hours 45 Minutes",
    examFormat: "Computer-Delivered & Paper-Based",
    examCouncil: "Cambridge Assessment / British Council / IDP",
    accentColor: "#dc5b6d",
    accentSoft: "#fff0f2",
    accentInk: "#7c1f31",
    gradientBackground: "linear-gradient(135deg, #170d18 0%, #2b111e 40%, #07182d 100%)",
    cardGlow: "rgba(220, 91, 109, 0.18)",
    icon: GraduationCap,
    modules: [
      {
        title: "Listening Comprehension",
        duration: "30 Minutes (+ 10m transfer on paper)",
        itemsCount: "4 Sections · 40 Questions",
        description:
          "Four recorded monologues and conversations covering daily social needs and academic educational contexts with varied accents.",
        focusSkills: ["Note Completion", "Multiple Choice", "Map & Diagram Labeling", "Short Answers"],
        icon: Headphones,
      },
      {
        title: "Academic Reading",
        duration: "60 Minutes",
        itemsCount: "3 Long Texts · 40 Questions",
        description:
          "Three extensive authentic texts sourced from scholarly journals, non-fiction books, and scientific periodicals with analytical prompts.",
        focusSkills: ["True/False/Not Given", "Heading Matching", "Summary Completion", "Author Viewpoint"],
        icon: BookOpen,
      },
      {
        title: "Academic Writing",
        duration: "60 Minutes",
        itemsCount: "2 Mandatory Tasks",
        description:
          "Task 1 graphical data synthesis (min 150 words in 20 min) followed by Task 2 persuasive academic argument essay (min 250 words in 40 min).",
        focusSkills: ["Task Achievement", "Cohesion & Coherence", "Lexical Resource", "Grammatical Range"],
        icon: PenTool,
      },
      {
        title: "Speaking Assessment",
        duration: "11 – 14 Minutes",
        itemsCount: "3-Part Live Interview",
        description:
          "Interactive one-on-one conversation evaluating everyday conversation, a 2-minute monologue on a cue card, and abstract thematic discussion.",
        focusSkills: ["Fluency & Coherence", "Pronunciation Nuance", "Lexical Range", "Idiomatic Usage"],
        icon: Mic,
      },
    ],
    proTips: [
      {
        title: "The 30-Second Question Scan",
        body: "In Listening, always use the 30-second preparation window to underline keywords and predict noun/number formats before the recording starts.",
        tag: "Listening",
      },
      {
        title: "Paragraph First-and-Last Strategy",
        body: "For Academic Reading matching headings, read the first two sentences and the concluding sentence of each paragraph first to extract the primary topic statement.",
        tag: "Reading",
      },
      {
        title: "Task 2 Balanced Thesis",
        body: "Spend a full 5 minutes planning Task 2: define your stance in the introduction, support with two distinct body arguments, and never introduce new ideas in the conclusion.",
        tag: "Writing",
      },
    ],
    testSizes: [
      {
        size: 20,
        label: "Quick Skill Sprint",
        durationEst: "15 – 20 Mins",
        recommendation: "Ideal for daily diagnostic practice and quick retention check.",
      },
      {
        size: 50,
        label: "Standard Section Drill",
        durationEst: "40 – 45 Mins",
        recommendation: "Balanced deep-dive covering all primary question typologies.",
      },
      {
        size: 100,
        label: "Full Exam Simulation",
        durationEst: "80 – 90 Mins",
        recommendation: "Complete high-stamina mock test simulating full test-day mental endurance.",
      },
    ],
  },
  oet: {
    slug: "oet",
    title: "OET for Healthcare",
    tagline: "Occupational English Test — Medical & Nursing Track",
    badge: "Clinical English Benchmark",
    heroKicker: "Curriculum Track 02",
    heroHeadline: "Clinical Communication Excellence for Healthcare Registration",
    heroDescription:
      "Targeted language training for healthcare practitioners seeking registration in the UK (NMC/GMC), Australia, Ireland, and New Zealand. Master patient consultations and clinical correspondence.",
    benchmarkTarget: "Grade B (350+) Target",
    examDuration: "3 Hours",
    examFormat: "Profession-Specific Assessment",
    examCouncil: "Cambridge Boxhill Language Assessment (CBLA)",
    accentColor: "#0aa69a",
    accentSoft: "#effbf5",
    accentInk: "#17643e",
    gradientBackground: "linear-gradient(135deg, #071e1c 0%, #0d3632 40%, #07182d 100%)",
    cardGlow: "rgba(10, 166, 154, 0.2)",
    icon: Stethoscope,
    modules: [
      {
        title: "Clinical Listening",
        duration: "45 Minutes",
        itemsCount: "3 Parts · 42 Questions",
        description:
          "Part A medical consultations (recorded patient-doctor/nurse dialogue), Part B healthcare workplace conversations, Part C medical lectures and presentations.",
        focusSkills: ["Consultation Note-taking", "Team Briefings", "Clinical Presentations", "Medical Terminology"],
        icon: Headphones,
      },
      {
        title: "Medical Reading",
        duration: "60 Minutes",
        itemsCount: "3 Parts · 42 Questions",
        description:
          "Part A expeditious reading for medical doses and protocols (15m), followed by Parts B & C analytical policy documents and clinical research papers (45m).",
        focusSkills: ["Rapid Protocol Scanning", "Safety Briefings", "Clinical Studies", "Hospital Guidelines"],
        icon: BookOpen,
      },
      {
        title: "Occupational Writing",
        duration: "45 Minutes",
        itemsCount: "1 Profession-Specific Case Letter",
        description:
          "Draft an authentic formal referral, transfer, or discharge letter based on extensive patient clinical case notes, maintaining clinical urgency and audience relevance.",
        focusSkills: ["Purpose Identification", "Conciseness & Selection", "Case Note Transformation", "Appropriate Tone"],
        icon: PenTool,
      },
      {
        title: "Clinical Role-Play",
        duration: "20 Minutes",
        itemsCount: "2 Profession-Specific Scenarios",
        description:
          "Face-to-face role-play with an interlocutor acting as a patient or caregiver. Demonstrates patient-centred communication, empathy, and professional rapport.",
        focusSkills: ["Empathy & Reassurance", "Information Gathering", "Explaining Prognosis", "Active Listening"],
        icon: Mic,
      },
    ],
    proTips: [
      {
        title: "Part A Rapid Cross-Referencing",
        body: "In OET Reading Part A, look at the table of contents of the 4 texts first. Never read word-for-word; search strictly for clinical quantities, contraindications, and dosages.",
        tag: "Reading",
      },
      {
        title: "Case Note Irrelevance Elimination",
        body: "In Writing, 30% of provided case notes are intentionally non-essential to the referral reason. Ruthlessly filter past family history if it has no bearing on current treatment.",
        tag: "Writing",
      },
      {
        title: "The ICE Consultation Framework",
        body: "In Speaking, elicit the patient's Ideas, Concerns, and Expectations (ICE) before prescribing advice. Markers award maximum clinical communication marks for patient-centred exploration.",
        tag: "Speaking",
      },
    ],
    testSizes: [
      {
        size: 20,
        label: "Clinical Quick Check",
        durationEst: "15 – 20 Mins",
        recommendation: "Focus on rapid protocol matching and medical vocabulary retention.",
      },
      {
        size: 50,
        label: "Mid-Term Clinical Drill",
        durationEst: "40 – 45 Mins",
        recommendation: "Comprehensive scenario questions mirroring actual OET question pools.",
      },
      {
        size: 100,
        label: "Full Board Simulation",
        durationEst: "80 – 90 Mins",
        recommendation: "High-intensity clinical mock testing to build professional stamina.",
      },
    ],
  },
  pte: {
    slug: "pte",
    title: "PTE Academic",
    tagline: "Pearson Test of English — Computer-Adaptive Academic",
    badge: "Pearson AI-Scored Standard",
    heroKicker: "Curriculum Track 03",
    heroHeadline: "Fast-Paced, Automated Computer Testing for Rapid Results",
    heroDescription:
      "Engineered specifically for candidates requiring quick turnarounds for Australia, Canada, New Zealand, and UK visa processing. Master speech recognition algorithms and automated writing scoring.",
    benchmarkTarget: "Score 79+ (Superior English)",
    examDuration: "2 Hours 15 Minutes",
    examFormat: "100% Computer-Adaptive Assessment",
    examCouncil: "Pearson PLC Language Testing",
    accentColor: "#5ba7e8",
    accentSoft: "#eef7ff",
    accentInk: "#174f84",
    gradientBackground: "linear-gradient(135deg, #091a2e 0%, #102d4f 40%, #07182d 100%)",
    cardGlow: "rgba(91, 167, 232, 0.2)",
    icon: MonitorCheck,
    modules: [
      {
        title: "Speaking & Writing",
        duration: "54 – 67 Minutes",
        itemsCount: "7 Integrated Item Types",
        description:
          "Read Aloud, Repeat Sentence, Describe Image, Re-tell Lecture, Answer Short Question, Summarize Written Text, and Write Essay assessed by Pearson automated algorithms.",
        focusSkills: ["Oral Fluency", "Acoustic Clarity", "Content Relevance", "Grammar & Spelling"],
        icon: Mic,
      },
      {
        title: "Adaptive Reading",
        duration: "29 – 30 Minutes",
        itemsCount: "5 Item Types",
        description:
          "Reading & Writing Fill in the Blanks, Multiple Choice (Multiple Answers), Re-order Paragraphs, Reading Fill in the Blanks, and Single Answer MCQ.",
        focusSkills: ["Collocation Awareness", "Cohesive Logic", "Contextual Vocabulary", "Speed Reading"],
        icon: BookOpen,
      },
      {
        title: "Integrated Listening",
        duration: "30 – 43 Minutes",
        itemsCount: "8 Item Types",
        description:
          "Summarize Spoken Text, Multiple Choice, Fill in Blanks, Highlight Correct Summary, Select Missing Word, Highlight Incorrect Words, and Write From Dictation.",
        focusSkills: ["Note-taking Speed", "Dictation Accuracy", "Accent Recognition", "Proofreading"],
        icon: Headphones,
      },
    ],
    proTips: [
      {
        title: "Speech Engine Monotone Avoidance",
        body: "Never speak in a robotic monotone. The Pearson speech analyzer measures natural oral fluency and rhythmic chunking. Never pause for longer than 2.5 seconds.",
        tag: "Speaking",
      },
      {
        title: "Write From Dictation Capitalization",
        body: "Write From Dictation carries the highest score weight in the entire exam. Double-check singular/plural endings and first-letter capitalization on every sentence.",
        tag: "Listening",
      },
      {
        title: "Collocation-First Reading Blank Fill",
        body: "Over 70% of Reading Fill in the Blanks test grammatical collocations. Learn prepositions that permanently lock with adjacent academic verbs and nouns.",
        tag: "Reading",
      },
    ],
    testSizes: [
      {
        size: 20,
        label: "AI Quick Assessment",
        durationEst: "15 Mins",
        recommendation: "Great for quick daily drills on high-frequency PTE exam questions.",
      },
      {
        size: 50,
        label: "Collocation & Logic Drill",
        durationEst: "40 Mins",
        recommendation: "Thorough multi-section practice across both reading and listening item types.",
      },
      {
        size: 100,
        label: "Comprehensive Mock Exam",
        durationEst: "80 Mins",
        recommendation: "Full simulation testing time-management, focus, and typing accuracy.",
      },
    ],
  },
  german: {
    slug: "german",
    title: "German Language Mastery",
    tagline: "Deutsch als Fremdsprache — A1, A2, B1 & B2",
    badge: "Goethe-Institut & TELC Aligned",
    heroKicker: "Curriculum Track 04",
    heroHeadline: "Complete German Proficiency for Career, Ausbildung & Study",
    heroDescription:
      "Structured learning path tailored for healthcare professionals, students, and skilled workers relocating to Germany, Austria, or Switzerland. Master complex grammar, conversational fluency, and professional German.",
    benchmarkTarget: "B2 Goethe / TELC Certified",
    examDuration: "Module-Based Examination",
    examFormat: "Written & Oral Proficiency",
    examCouncil: "Goethe-Institut / TELC / TestDaF",
    accentColor: "#e7c95a",
    accentSoft: "#fff9df",
    accentInk: "#6d5511",
    gradientBackground: "linear-gradient(135deg, #231d08 0%, #3e320c 40%, #07182d 100%)",
    cardGlow: "rgba(231, 201, 90, 0.22)",
    icon: Languages,
    modules: [
      {
        title: "Lesen (Reading)",
        duration: "65 Minutes (B1/B2)",
        itemsCount: "4 – 5 Thematic Sections",
        description:
          "Comprehension of short everyday notices, public announcements, and complex essays, articles, and comment pieces from German publications.",
        focusSkills: ["Globales Verstehen", "Selektives Verstehen", "Detailliertes Verstehen", "Textrekonstruktion"],
        icon: BookOpen,
      },
      {
        title: "Hören (Listening)",
        duration: "40 Minutes",
        itemsCount: "4 Audio Tasks",
        description:
          "Everyday telephone calls, public announcements, radio news broadcasts, and live interviews with authentic German, Austrian, and Swiss speakers.",
        focusSkills: ["Alltagskommunikation", "Hauptaussagen Erfassen", "Details Verstehen", "Standpunkte Erkennen"],
        icon: Headphones,
      },
      {
        title: "Schreiben (Writing)",
        duration: "60 – 75 Minutes",
        itemsCount: "2 – 3 Written Tasks",
        description:
          "Drafting personal and professional formal letters (Beschwerdebrief, Bewerbung, Bitte um Informationen) and structured opinion essays.",
        focusSkills: ["Satzbau & Konnektoren", "Höflichkeitsformeln", "Redemittel B2", "Kasus & Genus Präzision"],
        icon: PenTool,
      },
      {
        title: "Sprechen (Oral Exam)",
        duration: "15 Minutes (Pair Exam)",
        itemsCount: "3 Presentation & Debate Parts",
        description:
          "Spontaneous introduction, a 3-minute topical presentation with follow-up questions, and an interactive planning debate with an examination partner.",
        focusSkills: ["Freies Sprechen", "Argumentation", "Diskussion & Konsens", "Phonetik & Intonation"],
        icon: Mic,
      },
    ],
    proTips: [
      {
        title: "Verb Position (V2) Mastery",
        body: "In main clauses, the conjugated verb ALWAYS sits in position 2. In subordinate clauses introduced by 'weil', 'dass', 'obwohl', send the conjugated verb strictly to the very end.",
        tag: "Grammatik",
      },
      {
        title: "Noun Gender Color Coding",
        body: "Never learn a German noun without its definite article and plural form. Learn 'der Tisch, -e' (blue), 'die Lampe, -n' (red), 'das Buch, -¨er' (green). Noun gender drives all adjective endings.",
        tag: "Wortschatz",
      },
      {
        title: "Redemittel for B2 Writing",
        body: "Memorize high-scoring formal sentence starters: 'Ich wende mich an Sie, um mich über... zu beschweren' and 'Ein wesentlicher Vorteil besteht darin, dass...'",
        tag: "Schreiben",
      },
    ],
    testSizes: [
      {
        size: 20,
        label: "Grammatik-Blitz",
        durationEst: "15 Mins",
        recommendation: "Schnelltest for article cases (Akkusativ/Dativ), prepositions, and verb forms.",
      },
      {
        size: 50,
        label: "Intensiv-Training",
        durationEst: "40 Mins",
        recommendation: "Comprehensive questions covering reading comprehension, syntax, and idioms.",
      },
      {
        size: 100,
        label: "Vollständige Prüfungssimulation",
        durationEst: "80 Mins",
        recommendation: "Complete mock test replicating real Goethe-Zertifikat and TELC standards.",
      },
    ],
  },
};

export function getCoursePresentation(slug: string): CoursePresentation | undefined {
  return coursePresentations[slug as CourseSlug];
}
