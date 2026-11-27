import {
  BookOpen,
  CreditCard,
  LifeBuoy,
  Rocket,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * The help centre's topics and the questions each one answers.
 *
 * There is no knowledge-base table, so this is the content: every answer is
 * about how this portal works (raising, following and reopening requests,
 * attachments, signing in, the profile), which is the same for every tenant.
 * Nothing here speaks for a tenant's own product or policies -- those
 * questions go to the team, and each topic page ends with the request form,
 * opened with the topic's subject filled in.
 */

export type HelpQuestion = {
  /** Anchor on the topic page, so a question can be linked to. */
  id: string;
  question: string;
  answer: string;
};

export type HelpTopic = {
  slug: string;
  icon: LucideIcon;
  title: string;
  body: string;
  /** Pre-fills the request subject; null opens a blank request. */
  subject: string | null;
  /** Extra words the search box matches on, so "invoice" finds billing. */
  keywords: string;
  /** Icon tile colours. */
  tone: string;
  questions: HelpQuestion[];
};

export function helpTopics(productName: string): HelpTopic[] {
  return [
    {
      slug: "getting-started",
      icon: Rocket,
      title: "Getting started",
      body: "Learn the basics and set up your account.",
      subject: "Help getting started",
      keywords:
        "new account setup sign up signup onboarding first steps start profile how do i begin",
      tone: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300",
      questions: [
        {
          id: "what-can-i-do",
          question: "What can I do in this portal?",
          answer:
            "Raise requests with the support team, follow every reply on them, answer the team and attach files, and reopen a request if it comes back. The help centre and the chat assistant are here for quick answers along the way.",
        },
        {
          id: "raise-a-request",
          question: "How do I raise a request?",
          answer:
            "Choose New request on the Your requests page. Give it a short subject, describe what happened, and attach any screenshots or files that help. Once it's sent it appears in your list with its status.",
        },
        {
          id: "where-are-replies",
          question: "Where do I see the team's replies?",
          answer:
            "Open the request from Your requests. The whole conversation is there, newest at the bottom, and you can reply from the box underneath it.",
        },
        {
          id: "reply-time",
          question: "How quickly will I hear back?",
          answer:
            "The request form shows how soon the team aims to reply on your support plan. If support is closed when you write, the form says when it opens again, and your request waits in the queue until then.",
        },
      ],
    },
    {
      slug: "account-and-billing",
      icon: CreditCard,
      title: "Account & billing",
      body: "Manage your plan, payments and invoices.",
      subject: "Question about my account or billing",
      keywords:
        "invoice payment payments plan plans subscription subscribe billing charge charged card credit card receipt refund price pricing upgrade downgrade cancel profile name photo company email",
      tone: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300",
      questions: [
        {
          id: "billing-question",
          question: "I have a question about an invoice or my plan",
          answer:
            "Raise a request and the team will pick it up. Including the invoice number, its date and the amount you're asking about gets you an answer faster.",
        },
        {
          id: "update-profile",
          question: "How do I change my name, photo or company?",
          answer:
            "Open the menu under your name at the top right and choose Profile settings. Your changes are saved for the next time you sign in too.",
        },
        {
          id: "change-email",
          question: "Can I change the email I sign in with?",
          answer:
            "Not from the portal: it's the address the team knows you by. Raise a request asking for the change and the team will help.",
        },
      ],
    },
    {
      slug: "using-the-product",
      icon: BookOpen,
      title: `Using ${productName}`,
      body: "Guides and best practices.",
      subject: `How do I… (using ${productName})`,
      keywords:
        "how do i how to guide guides feature features workflow workflows best practice practices settings options configuration dashboard report reports screenshot",
      tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
      questions: [
        {
          id: "how-do-i",
          question: `How do I ask a "how do I…" question about ${productName}?`,
          answer:
            "Raise a request saying what you're trying to do, where you got to, and where you're stuck. A screenshot of the screen you're on saves a round of questions.",
        },
        {
          id: "attach-files",
          question: "Can I attach screenshots and files?",
          answer:
            "Yes: up to 5 files with each message, 20 MB each. Drag them onto the request form or reply box, or browse for them. Most common types are fine; a few, such as web pages, aren't accepted for safety.",
        },
        {
          id: "chat-assistant",
          question: "Can the chat assistant help?",
          answer:
            "It can check where your requests stand, explain how the portal works, and draft a new request for you to check and confirm. Nothing is sent to the team until you confirm it.",
        },
      ],
    },
    {
      slug: "troubleshooting",
      icon: Wrench,
      title: "Troubleshooting",
      body: "Something isn't working as expected.",
      subject: "Something isn't working",
      keywords:
        "error errors broken bug crash crashed failed failing failure issue problem stuck blank loading slow doesn't work not working cannot can't won't freeze frozen reopen upload",
      tone: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
      questions: [
        {
          id: "what-to-include",
          question: "What should I include when reporting a problem?",
          answer:
            "What happened, when it started, and the steps you've already tried. Copy any error message word for word, and attach a screenshot if you can.",
        },
        {
          id: "waiting-on-you",
          question: 'My request says "Waiting on you". What does that mean?',
          answer:
            "The team has replied and needs something from you to carry on. Open the request and reply; it goes back to the team as soon as you do.",
        },
        {
          id: "problem-came-back",
          question: "The problem came back after my request was resolved",
          answer:
            "Open the request and choose Reopen request. It goes back into the team's queue with the whole history, so there's no need to explain it all again.",
        },
        {
          id: "upload-fails",
          question: "My attachment won't upload",
          answer:
            "Check that each file is under 20 MB and that you're sending no more than 5 at once. If it still fails, describe the file in the request and the team will suggest another way to send it.",
        },
      ],
    },
    {
      slug: "security",
      icon: ShieldCheck,
      title: "Security",
      body: "Keep your account safe.",
      subject: "Security question",
      keywords:
        "password passwords login log in signin sign in access locked out hack hacked compromised suspicious privacy permissions permission email link",
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
      questions: [
        {
          id: "how-to-sign-in",
          question: "How do I sign in?",
          answer:
            "With a sign-in link sent to your email, or with a password if you've set one. Either way it's the same account and the same requests.",
        },
        {
          id: "set-password",
          question: "How do I set or change my password?",
          answer:
            "Open the menu under your name at the top right and choose Change password. If you've only ever used email links, this sets your first password.",
        },
        {
          id: "who-can-see",
          question: "Who can see my requests?",
          answer:
            "Only you and the support team. Other customers never see your requests or the files on them.",
        },
        {
          id: "suspicious-activity",
          question: "I think someone else has used my account",
          answer:
            "Change your password straight away, then raise a request telling the team what you noticed and when.",
        },
      ],
    },
    {
      slug: "contact-support",
      icon: LifeBuoy,
      title: "Contact support",
      body: "Still need help? Submit a request.",
      subject: null,
      keywords:
        "contact support help team agent human person someone talk message question ask speak hours",
      tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300",
      questions: [
        {
          id: "ways-to-reach",
          question: "How do I reach the support team?",
          answer:
            "Raise a request: a person on the team replies on it, and you'll find the whole conversation under Your requests. For a quick answer about a request you already have, the chat assistant can look it up.",
        },
        {
          id: "support-hours",
          question: "When is the team available?",
          answer:
            "The support hours are shown at the bottom of the portal pages. You can raise a request at any time; out of hours it waits in the queue until the team is back.",
        },
      ],
    },
  ];
}

export function findHelpTopic(
  productName: string,
  slug: string,
): HelpTopic | null {
  return helpTopics(productName).find((topic) => topic.slug === slug) ?? null;
}

/** The request form's address for a topic, its subject filled in. */
export function helpTopicRequestHref(
  newRequest: string,
  topic: Pick<HelpTopic, "subject">,
): string {
  return topic.subject
    ? `${newRequest}?subject=${encodeURIComponent(topic.subject)}`
    : newRequest;
}
