import heroLoungeImg from '../assets/images/hero_oriental_lounge_1794767860533.jpg';
import tanouraStageImg from '../assets/images/show_tanoura_stage_1794767860908.jpg';
import mixedGrillImg from '../assets/images/dish_mixed_grill_1794767860958.jpg';
import babaGhanoushImg from '../assets/images/dish_baba_ghanoush_1794767861871.jpg';
import sahlabDrinkImg from '../assets/images/drink_sahlab_oriental_1794767862161.jpg';
import luxuryShishaImg from '../assets/images/shisha_luxury_brass_1794767863161.jpg';
import indoorSeatingImg from '../assets/images/indoor_family_seating_1794772308929.jpg';
import lambTagineImg from '../assets/images/dish_lamb_tagine_1794776282650.jpg';
import omAliTeaImg from '../assets/images/dessert_om_ali_tea_1794776284110.jpg';
import oudStageNightImg from '../assets/images/stage_oud_singer_night_1794776285707.jpg';
import mezzePlatterImg from '../assets/images/dish_mezze_platter_1794776325484.jpg';
import fruitShishaImg from '../assets/images/shisha_fruit_bowl_1794776325984.jpg';

export const MEDIA_ASSETS = {
  realStage: '/assets/aistudio/unnamed_4c0f9bf8.jpg',
  realBabaGhanoush: '/assets/aistudio/unnamed_4fb91f38.jpg',
  realSahlab: '/assets/aistudio/unnamed_062b5ea3.jpg',
  realSweetFeteer: '/assets/aistudio/unnamed_e52c3130.jpg',
  realMargheritaPizza: '/assets/aistudio/unnamed_96e29555.jpg',
  realSpecialPizza: '/assets/aistudio/unnamed_83c1f666.jpg',
  realFamilyFeast: '/assets/aistudio/unnamed_abe10b29.jpg',
  realChickenMeal: '/assets/aistudio/unnamed_a967c94f.jpg',
  realTurkishCoffee: '/assets/aistudio/unnamed_5541fdd1.jpg',
  realTabbouleh: '/assets/aistudio/unnamed_fc26e938.jpg',
  heroLounge: heroLoungeImg,
  tanouraStage: tanouraStageImg,
  mixedGrill: mixedGrillImg,
  babaGhanoush: babaGhanoushImg,
  sahlabDrink: sahlabDrinkImg,
  luxuryShisha: luxuryShishaImg,
  indoorSeating: indoorSeatingImg,
  lambTagine: lambTagineImg,
  omAliTea: omAliTeaImg,
  oudStageNight: oudStageNightImg,
  mezzePlatter: mezzePlatterImg,
  fruitShisha: fruitShishaImg,
} as const;

export const IMAGE_PRESET_MAP: Record<string, string> = {
  '/assets/aistudio/unnamed_4c0f9bf8.jpg': '/assets/aistudio/unnamed_4c0f9bf8.jpg',
  '/assets/aistudio/unnamed_4fb91f38.jpg': '/assets/aistudio/unnamed_4fb91f38.jpg',
  '/assets/aistudio/unnamed_062b5ea3.jpg': '/assets/aistudio/unnamed_062b5ea3.jpg',
  '/assets/aistudio/unnamed_e52c3130.jpg': '/assets/aistudio/unnamed_e52c3130.jpg',
  '/assets/aistudio/unnamed_96e29555.jpg': '/assets/aistudio/unnamed_96e29555.jpg',
  '/assets/aistudio/unnamed_83c1f666.jpg': '/assets/aistudio/unnamed_83c1f666.jpg',
  '/assets/aistudio/unnamed_abe10b29.jpg': '/assets/aistudio/unnamed_abe10b29.jpg',
  '/assets/aistudio/unnamed_a967c94f.jpg': '/assets/aistudio/unnamed_a967c94f.jpg',
  '/assets/aistudio/unnamed_5541fdd1.jpg': '/assets/aistudio/unnamed_5541fdd1.jpg',
  '/assets/aistudio/unnamed_fc26e938.jpg': '/assets/aistudio/unnamed_fc26e938.jpg',
  '/src/assets/images/hero_oriental_lounge_1794767860533.jpg': heroLoungeImg,
  '/src/assets/images/show_tanoura_stage_1794767860908.jpg': tanouraStageImg,
  '/src/assets/images/dish_mixed_grill_1794767860958.jpg': mixedGrillImg,
  '/src/assets/images/dish_baba_ghanoush_1794767861871.jpg': babaGhanoushImg,
  '/src/assets/images/drink_sahlab_oriental_1794767862161.jpg': sahlabDrinkImg,
  '/src/assets/images/shisha_luxury_brass_1794767863161.jpg': luxuryShishaImg,
  '/src/assets/images/indoor_family_seating_1794772308929.jpg': indoorSeatingImg,
  '/src/assets/images/dish_lamb_tagine_1794776282650.jpg': lambTagineImg,
  '/src/assets/images/dessert_om_ali_tea_1794776284110.jpg': omAliTeaImg,
  '/src/assets/images/stage_oud_singer_night_1794776285707.jpg': oudStageNightImg,
  '/src/assets/images/dish_mezze_platter_1794776325484.jpg': mezzePlatterImg,
  '/src/assets/images/shisha_fruit_bowl_1794776325984.jpg': fruitShishaImg,
};

export const PRESET_IMAGE_OPTIONS = [
  { id: 'real_stage', labelAr: 'الصالة الشرقية العائلية (صورة من الفرع)', url: '/assets/aistudio/unnamed_4c0f9bf8.jpg' },
  { id: 'real_baba', labelAr: 'بابا غنوج حقيقي (صورة من الفرع)', url: '/assets/aistudio/unnamed_4fb91f38.jpg' },
  { id: 'real_sahlab', labelAr: 'سحلب باللوز وجوز الهند (صورة من الفرع)', url: '/assets/aistudio/unnamed_062b5ea3.jpg' },
  { id: 'real_feteer', labelAr: 'فطير بالسكر البودرة (صورة من الفرع)', url: '/assets/aistudio/unnamed_e52c3130.jpg' },
  { id: 'real_margherita', labelAr: 'بيتزا مارجريتا (صورة من الفرع)', url: '/assets/aistudio/unnamed_96e29555.jpg' },
  { id: 'real_special_pizza', labelAr: 'بيتزا سبيشيال بالسجق (صورة من الفرع)', url: '/assets/aistudio/unnamed_83c1f666.jpg' },
  { id: 'real_feast', labelAr: 'سفرة صاحب السعادة العائلية (صورة من الفرع)', url: '/assets/aistudio/unnamed_abe10b29.jpg' },
  { id: 'real_chicken', labelAr: 'وجبة دجاج مشوي وأرز (صورة من الفرع)', url: '/assets/aistudio/unnamed_a967c94f.jpg' },
  { id: 'real_coffee', labelAr: 'قهوة تركي أصلي (صورة من الفرع)', url: '/assets/aistudio/unnamed_5541fdd1.jpg' },
  { id: 'real_tabbouleh', labelAr: 'سلطة تبولة شامية (صورة من الفرع)', url: '/assets/aistudio/unnamed_fc26e938.jpg' },
  { id: 'mixed_grill', labelAr: 'مشويات مشكلة على الفحم', url: '/src/assets/images/dish_mixed_grill_1794767860958.jpg' },
  { id: 'lamb_tagine', labelAr: 'طاجن موزة ضاني بالبرقوق', url: '/src/assets/images/dish_lamb_tagine_1794776282650.jpg' },
  { id: 'baba_ghanoush', labelAr: 'بابا غنوج مشوي بالرمان', url: '/src/assets/images/dish_baba_ghanoush_1794767861871.jpg' },
  { id: 'mezze_platter', labelAr: 'صينية مزة شرقية مشكلة', url: '/src/assets/images/dish_mezze_platter_1794776325484.jpg' },
  { id: 'sahlab', labelAr: 'سحلب ملكي بالمكسرات', url: '/src/assets/images/drink_sahlab_oriental_1794767862161.jpg' },
  { id: 'om_ali', labelAr: 'طاجن أم علي وشاي بالنعناع', url: '/src/assets/images/dessert_om_ali_tea_1794776284110.jpg' },
  { id: 'indoor_seating', labelAr: 'الجلسات العائلية الداخلية', url: '/src/assets/images/indoor_family_seating_1794772308929.jpg' },
  { id: 'hero_lounge', labelAr: 'واجهة مطعم وكافيه صاحب السعادة', url: '/src/assets/images/hero_oriental_lounge_1794767860533.jpg' },
] as const;

export function resolveMediaUrl(url: string): string {
  const mapped = IMAGE_PRESET_MAP[url] ?? url;
  if (typeof mapped === 'string' && mapped.includes('images.unsplash.com/')) {
    const base = mapped.split('?')[0];
    return `${base}?auto=format&fit=crop&w=500&q=70`;
  }
  return mapped;
}
