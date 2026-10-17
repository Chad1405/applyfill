// Starting values for a fresh install. Everything is edited on the Options page
// and saved in chrome.storage.local; nothing here is ever sent anywhere.
var APPLYFILL_DEFAULTS = {
  profile: {
    firstName: "", lastName: "", fullName: "", email: "", phone: "", phoneIntl: "",
    city: "", country: "", postcode: "", address: "",
    linkedin: "", website: "", github: "",
    currentCompany: "", currentTitle: "", yearsExperience: "",
    university: "", degree: "", graduationYear: "",
    noticePeriod: "", salaryExpectation: "",
    rightToWork: "", needsSponsorship: "", nationality: "", pronouns: "",
    howHeard: "LinkedIn"
  },

  // Saved answers for open questions. "match" is a comma-separated list of words;
  // a question containing any of them gets that answer suggested.
  // {company} and {role} are filled in from the page. Replace the [brackets] with your own story.
  library: [
    {
      title: "Why this company",
      match: "why do you want, why are you interested, why us, why join, motivat, interest in this role, why this role",
      text: "I want to work at {company} because [what draws you to the company or product]. In my current role at [company] I [the most relevant thing you do], and I'd like to bring that to {role}, where [why it matters more there]."
    },
    {
      title: "Project you're proud of",
      match: "project you, tell us about a project, something you built, technical project, proud of",
      text: "At [company] I [built / led] [project]: [one sentence on what it does]. I [your specific part]. It [measurable result, e.g. cut X by Y%], and [how it was adopted or what happened next]."
    },
    {
      title: "Working with stakeholders",
      match: "stakeholder, non-technical, business team, communicat, explain, customer, client facing",
      text: "In my role at [company] I work closely with [who]. I start from what the process actually needs before proposing anything, agree what success looks like, and [how you keep people bought in]. For example, [short example with an outcome]."
    },
    {
      title: "Greatest achievement",
      match: "achievement, impact, accomplish, success, result",
      text: "[Achievement] at [company]: [what you did] which led to [measurable result]."
    },
    {
      title: "About you",
      match: "about you, about yourself, summary, introduce, describe yourself, background, additional information, anything else",
      text: "I'm a [role] with [N] years of experience in [area]. Most recently at [company] I [headline achievement]. [One line on what you want to do next]."
    },
    {
      title: "Notice period",
      match: "notice, start date, when can you start, availability to start",
      text: "My notice period is [length]."
    },
    {
      title: "Salary expectations",
      match: "salary, compensation, pay expectation, expected pay, remuneration",
      text: "I'm looking for a base salary of [amount], depending on the overall package."
    }
  ],

  settings: {
    apiKey: "",
    model: "claude-sonnet-5-5",
    cvText: ""
  }
};
