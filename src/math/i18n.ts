export type Language = "English" | "Arabic" | "French" | "Spanish";

export const LANGUAGES: readonly Language[] = ["English", "Arabic", "French", "Spanish"];

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}

export type Texts = {
  /** Default title shown at the start. */
  title: string;
  subtitle: string;
  /** "{n}" and "{total}" are replaced by numbers. */
  questionOf: string;
  answer: string;
  outro: string;
  outroSub: string;
  rtl: boolean;
};

export const TEXTS: Record<Language, Texts> = {
  English: {
    title: "Math Challenge!",
    subtitle: "Can you solve it before time runs out?",
    questionOf: "Question {n} of {total}",
    answer: "Answer",
    outro: "Great job!",
    outroSub: "Thanks for watching! Subscribe for more math fun",
    rtl: false,
  },
  Arabic: {
    title: "تحدّي الرياضيات!",
    subtitle: "هل تحلّها قبل انتهاء الوقت؟",
    questionOf: "السؤال {n} من {total}",
    answer: "الإجابة",
    outro: "أحسنت!",
    outroSub: "شكراً للمشاهدة! اشترك لمزيد من المرح مع الأرقام",
    rtl: true,
  },
  French: {
    title: "Défi de maths !",
    subtitle: "Peux-tu répondre avant la fin du temps ?",
    questionOf: "Question {n} sur {total}",
    answer: "Réponse",
    outro: "Bravo !",
    outroSub: "Merci d'avoir regardé ! Abonne-toi pour plus de maths",
    rtl: false,
  },
  Spanish: {
    title: "¡Reto de mates!",
    subtitle: "¿Puedes resolverlo antes de que acabe el tiempo?",
    questionOf: "Pregunta {n} de {total}",
    answer: "Respuesta",
    outro: "¡Muy bien!",
    outroSub: "¡Gracias por ver! Suscríbete para más diversión con mates",
    rtl: false,
  },
};

export function questionLabel(texts: Texts, n: number, total: number): string {
  return texts.questionOf.replace("{n}", String(n)).replace("{total}", String(total));
}
