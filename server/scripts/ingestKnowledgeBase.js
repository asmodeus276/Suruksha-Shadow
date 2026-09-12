import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { embedText } from "../lib/embeddings.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Curated knowledge base for FR12. Written in plain language on purpose —
 * both so Sahara can ground replies in genuinely useful summaries (not
 * dense statute text a scared person can't parse), and so this stays
 * clearly a paraphrase, not a reproduction, of the underlying law.
 *
 * Sources cross-checked against: the Bureau of Police Research &
 * Development's official BNS handbook (bprd.nic.in), multiple independent
 * legal-summary sources for BNS section numbers, and the POSH Act 2013 /
 * POSH Rules 2013 as summarized across several 2026 compliance guides.
 * Helpline numbers checked against NCW's own site and multiple
 * independent directories, current as of mid-2026.
 *
 * IMPORTANT: this is NOT legal advice, and neither is Sahara. This
 * exists to reduce the odds of the model confidently inventing a wrong
 * section number or timeline — it does not make the app a substitute for
 * an actual lawyer or the police.
 */
const DOCUMENTS = [
  // --- BNS (Bharatiya Nyaya Sanhita, 2023 — replaced the IPC on 1 July 2024) ---
  {
    source: "BNS",
    title: "BNS overview and how it relates to the old IPC",
    content:
      "The Bharatiya Nyaya Sanhita (BNS), 2023 replaced the 1860 Indian Penal Code (IPC) on 1 July 2024. It's India's current criminal code. If someone mentions an old IPC section number (like 354A), it now maps to a new BNS section number — for example, IPC 354A (sexual harassment) is now BNS Section 75.",
  },
  {
    source: "BNS",
    title: "BNS Section 74 — assault or criminal force to outrage a woman's modesty",
    content:
      "BNS Section 74 covers assault or use of criminal force against a woman with the intent (or knowledge that it's likely) to outrage her modesty. This is separate from sexual harassment (Section 75) and covers physical acts of assault/force done with that intent.",
  },
  {
    source: "BNS",
    title: "BNS Section 75 — sexual harassment",
    content:
      "BNS Section 75 defines sexual harassment as: unwelcome physical contact and explicit sexual advances; a demand or request for sexual favors; showing pornography without consent; or making sexually colored remarks. Punishment ranges from 1 to 3 years imprisonment, a fine, or both, depending on which specific act occurred.",
  },
  {
    source: "BNS",
    title: "BNS Section 76 — assault or criminal force to disrobe a woman",
    content:
      "BNS Section 76 covers assault or criminal force used against a woman, or abetting such an act, with the intent to disrobe her or compel her to be naked.",
  },
  {
    source: "BNS",
    title: "BNS Section 77 — voyeurism",
    content:
      "BNS Section 77 covers watching or capturing the image of a woman engaged in a private act (where she'd reasonably expect not to be observed), including circumstances where her genitals, buttocks, or breasts are exposed, or where she's using a toilet, without her consent. This extends to digital/online distribution of such images.",
  },
  {
    source: "BNS",
    title: "BNS Section 78 — stalking",
    content:
      "BNS Section 78 covers a man following a woman and contacting or attempting to contact her despite her clear disinterest, or monitoring her use of the internet, email, or other electronic communication, or watching or spying on her in a way that leads to a reasonable fear for her safety or that of someone connected to her. First offense: up to 3 years imprisonment plus a fine. Repeat offense: up to 5 years plus a fine.",
  },
  {
    source: "BNS",
    title: "BNS Section 79 — word, gesture, or act intended to insult a woman's modesty",
    content:
      "BNS Section 79 covers uttering words, making sounds or gestures, exhibiting an object, or intruding on a woman's privacy with the intent to insult her modesty. This is the section most often used for a single incident of verbal harassment, catcalling, or an offensive gesture that doesn't rise to physical assault. Punishment: up to 3 years imprisonment plus a fine.",
  },
  {
    source: "BNS",
    title: "BNS Sections 63/64 — rape",
    content:
      "BNS Section 63 defines the offence of rape. Section 64 sets out the punishment: rigorous imprisonment of at least 10 years, which may extend to life imprisonment, plus a fine. If the victim is under 18 or the act results in a persistent vegetative state, the punishment can extend to death.",
  },
  {
    source: "BNS",
    title: "BNS Section 70 — gang rape",
    content:
      "BNS Section 70 covers gang rape (where a woman is raped by one or more people acting together, or in furtherance of a common intention). Punishment is rigorous imprisonment of at least 20 years, which may extend to life imprisonment (meaning the remainder of that person's natural life), plus a fine. If the victim is under 18, punishment can extend to death.",
  },
  {
    source: "BNS",
    title: "BNS Section 80 — dowry death",
    content:
      "BNS Section 80 covers dowry death: where a married woman dies from burns, bodily injury, or under otherwise unnatural circumstances within 7 years of marriage, and it's shown she was subjected to cruelty or harassment for dowry shortly before her death. Punishment is a minimum of 7 years imprisonment, which may extend to life imprisonment. Importantly, the burden of proof partially shifts — if these circumstances are shown, the law presumes the husband/in-laws caused the death unless they can prove otherwise.",
  },
  {
    source: "BNS",
    title: "BNS Sections 85 & 86 — cruelty by husband or his relatives (domestic violence)",
    content:
      "BNS Section 85 makes it a crime for a husband or his relatives to subject a woman to cruelty — punishable by up to 3 years imprisonment plus a fine. Section 86 defines 'cruelty' as: willful conduct likely to drive the woman to suicide, or to cause grave injury or danger to her physical or mental health; OR harassment aimed at coercing her (or her family) to meet an unlawful demand for money, property, or dowry. This is a cognizable, non-bailable, non-compoundable offence, meaning police must register an FIR, bail isn't automatic, and the case can't simply be withdrawn once filed. Ordinary marital disagreements alone don't meet this bar — it's specifically for willful, harmful conduct.",
  },
  {
    source: "BNS",
    title: "BNS Section 87 — kidnapping or abducting a woman to compel marriage",
    content:
      "BNS Section 87 covers kidnapping or abducting a woman, or inducing her by deceitful means, with the intent to force or seduce her into marriage against her will, or in circumstances likely to lead to her being forced into illicit intercourse.",
  },
  {
    source: "BNS",
    title: "BNS Section 124 — acid attacks",
    content:
      "BNS Section 124 covers voluntarily causing grievous hurt using acid or a similar corrosive substance, including attempts to do so or throwing/administering acid with intent to cause such injury. This carries serious punishment reflecting the severity and often-permanent harm of acid attacks.",
  },
  {
    source: "BNS",
    title: "Filing a police complaint — FIR and Zero FIR",
    content:
      "An FIR (First Information Report) is the document police register to start investigating a crime. For serious offences (like most crimes against women), police are legally required to register an FIR — they cannot refuse just because the incident happened outside their jurisdiction. This is called a 'Zero FIR': you can file it at ANY police station, and it gets transferred to the right jurisdiction afterward. This means you don't have to travel to a specific police station or know exactly which one 'covers' where something happened — the nearest one must take your complaint.",
  },

  // --- POSH Act, 2013 (workplace sexual harassment) ---
  {
    source: "POSH",
    title: "POSH Act — what it covers and who it protects",
    content:
      "The Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 (POSH Act) applies to every organization in India with 10 or more employees — private companies, government departments, NGOs, and more. It protects all women at that workplace: permanent, temporary, contractual, and part-time employees, interns, trainees, apprentices, and even women visiting as clients or vendors. Domestic workers are also covered. It applies not just at the physical workplace but also during work travel, off-site meetings, training, and virtual/remote work interactions.",
  },
  {
    source: "POSH",
    title: "POSH — Internal Complaints Committee (ICC) and Local Complaints Committee (LCC)",
    content:
      "Workplaces with 10+ employees must have an Internal Complaints Committee (ICC) to handle complaints: a senior woman employee as Presiding Officer, at least two other internal members, and one external member from an NGO or with relevant legal expertise. If a workplace has fewer than 10 employees, or the complaint is against the employer themselves, or it's an informal-sector/domestic-worker situation, the woman can instead approach the district-level Local Complaints Committee (LCC).",
  },
  {
    source: "POSH",
    title: "POSH — timelines for filing and resolving a complaint",
    content:
      "A complaint must be filed within 3 months of the incident (extendable by another 3 months, up to 6 months total, if the Committee accepts a valid reason for the delay — courts have read this generously in cases involving trauma or fear of retaliation). Once filed, the Committee must complete its inquiry within 90 days. After the inquiry report, the employer must act on the Committee's recommendations within 60 days. Either party can appeal the outcome within 90 days.",
  },
  {
    source: "POSH",
    title: "POSH — penalties for non-compliance and the option to also file criminally",
    content:
      "If an employer fails to comply with the POSH Act (e.g. not setting up an ICC, not acting on a valid complaint), they can be fined up to ₹50,000 for a first offense under Section 26, with higher penalties or even cancellation of business licenses for repeat non-compliance. Filing a POSH complaint doesn't use up your only option — a woman can file a POSH complaint with her employer's Committee AND a separate criminal complaint (e.g. under BNS Section 75) at the same time; the two processes run independently of each other.",
  },
  {
    source: "POSH",
    title: "POSH — confidentiality of the complaint and inquiry",
    content:
      "Section 16 of the POSH Act requires that the identity of the complainant, the respondent, witnesses, and details of the complaint, inquiry, and any recommendations stay confidential — they cannot be published, communicated to the media, or made public. This protects the complainant from being identified or facing reputational fallout during the process. Breaching this confidentiality requirement is itself punishable under the Act's service rules.",
  },
  {
    source: "POSH",
    title: "POSH — interim relief and protection from retaliation during the inquiry",
    content:
      "While an inquiry is ongoing, the Committee can recommend interim measures under Section 12 — such as transferring the complainant or the person she's complained about, granting the complainant leave (up to 3 months, counted separately from her normal leave), or restraining the respondent from supervising or reporting on her work. The Act is also designed to protect a complainant who has acted in good faith from retaliation — a complaint that simply isn't proven is not automatically treated as a 'false' complaint; only complaints made maliciously, with fabricated evidence, are handled under the Act's provisions for misuse.",
  },
  {
    source: "POSH",
    title: "POSH — what counts as 'the workplace'",
    content:
      "The POSH Act's definition of workplace is broader than just the office. It covers any place visited for work purposes, including during work-related travel — transportation provided by the employer for commuting to and from work is also covered. It extends to off-site client visits, training programs, conferences, and (per updated guidance) virtual or remote work interactions, such as harassment occurring over official messaging platforms or video calls.",
  },
  {
    source: "POSH",
    title: "POSH — employer's legal duties",
    content:
      "Section 19 requires every employer to: provide a safe working environment; display the penal consequences of sexual harassment prominently at the workplace; organize regular awareness workshops and training for employees and Committee members; assist the woman if she chooses to also file a police complaint; and monitor the timely submission of the Internal Committee's reports. Employers who fail these duties are separately liable under Section 26, on top of any specific complaint outcome.",
  },

  // --- Verified helpline / NGO directory ---
  {
    source: "NGO directory",
    title: "112 — Pan-India Emergency Number",
    content:
      "112 is India's unified emergency response number, covering police, fire, and medical emergencies in one call, available across the country. This is the number to call for any immediate, in-progress danger.",
  },
  {
    source: "NGO directory",
    title: "100 — Police",
    content: "100 connects directly to police for immediate assistance anywhere in India.",
  },
  {
    source: "NGO directory",
    title: "1091 — Women Helpline (Women in Distress)",
    content:
      "1091 is a dedicated national helpline for women facing harassment, abuse, or violence. It connects the caller directly with police and support services.",
  },
  {
    source: "NGO directory",
    title: "181 — Women Helpline (National)",
    content:
      "181 is a national helpline for women, focused on domestic violence and harassment. It offers counseling, coordination with local authorities, and in many states is integrated with the 112 emergency response system.",
  },
  {
    source: "NGO directory",
    title: "1098 — Child Helpline",
    content:
      "1098 is India's dedicated helpline for children in distress, including cases involving abuse, neglect, or exploitation of a minor.",
  },
  {
    source: "NGO directory",
    title: "1930 — National Cyber Crime Helpline",
    content:
      "1930 is the national helpline for reporting cyber crime — including online harassment, stalking via digital means, image-based abuse (like non-consensual sharing of photos/videos), and financial cyber fraud.",
  },
  {
    source: "NGO directory",
    title: "National Commission for Women (NCW)",
    content:
      "The National Commission for Women (NCW) is a statutory body that handles complaints related to women's rights, including workplace harassment and domestic violence, and can help escalate a case with authorities. Their published helpline number is 7827170170. Their official website (ncw.gov.in) lists current state-wise helpline numbers, since these can change.",
  },
  {
    source: "NGO directory",
    title: "15100 — NALSA free legal aid helpline",
    content:
      "15100 is the National Legal Services Authority's (NALSA) toll-free helpline, connecting callers with a panel lawyer for free legal guidance — available in 10 Indian languages. NALSA provides completely free legal aid and representation, particularly for women and other groups the law recognizes as needing support, through District and State Legal Services Authorities across the country.",
  },
  {
    source: "NGO directory",
    title: "One Stop Centres (branded 'Sakhi' in several states)",
    content:
      "One Stop Centres are government-run facilities (a Ministry of Women and Child Development initiative) providing integrated support to women facing any form of violence — domestic violence, sexual harassment, acid attacks, trafficking — all under one roof: medical assistance, police liaison, legal aid, psychological counseling, and temporary shelter if needed. They're present in most districts across India and are accessible 24/7, typically reachable through the 181 Women Helpline.",
  },
  {
    source: "NGO directory",
    title: "Domestic Violence Protection Officers",
    content:
      "Under the Protection of Women from Domestic Violence Act, 2005, every district has a designated Protection Officer whose job is to help a woman access civil remedies — like a protection order, a right to stay in the shared household (residence order), or monetary relief — through the courts, separate from any criminal case. A One Stop Centre or the 181 Women Helpline can help connect someone to their district's Protection Officer.",
  },
];

async function main() {
  console.log(`Ingesting ${DOCUMENTS.length} knowledge base documents...`);

  // Clear existing rows first so re-running this script after an edit
  // doesn't leave stale duplicates alongside updated content.
  const { error: deleteError } = await supabase
    .from("knowledge_documents")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete-all guard
  if (deleteError) {
    console.error("Failed to clear existing knowledge_documents:", deleteError.message);
    process.exit(1);
  }

  for (const doc of DOCUMENTS) {
    try {
      const embedding = await embedText(doc.content, "RETRIEVAL_DOCUMENT");
      const { error } = await supabase.from("knowledge_documents").insert({
        source: doc.source,
        title: doc.title,
        content: doc.content,
        embedding,
      });
      if (error) throw error;
      console.log(`  ✓ [${doc.source}] ${doc.title}`);
    } catch (err) {
      console.error(`  ✗ [${doc.source}] ${doc.title} — ${err.message}`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main();