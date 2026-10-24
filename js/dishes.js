// Lab-measured hawker dishes from Yeo, Bi, Yeo & Henry (2021), "Energy Content and Nutrient
// Profiles of Frequently Consumed Meals in Singapore", Foods 10(7):1659, CC BY 4.0.
// https://doi.org/10.3390/foods10071659
// One plate of each, bought at a Kopitiam food court. Energy by NIR, sodium by ICP-MS.
// Values are copied as printed: portion g, kJ/100 g, protein, fat and carbs g/100 g (Tables 1-3),
// and sodium mg per portion (Tables 7-9). Per-plate values are worked out from these.
// Tables 4-6 (per plate) are not used: three rows there disagree with Tables 1-3.
// name is ours; paper is the dish as the paper names it.
// [name, paper, grams, kJ per 100 g, protein, fat, carbs per 100 g, sodium mg per plate]
const ROWS = [
  ['Chicken rice, steamed', 'Steamed Chicken Rice', 412, 789, 9.3, 7.4, 21.2, 638],
  ['Chicken rice, roasted', 'Roasted Chicken Rice', 285, 768, 8.3, 6.3, 23.4, 489],
  ['Char kway teow', 'Char Kuay Teow', 362, 762, 4.0, 6.3, 27.4, 929],
  ['Yang zhou fried rice', 'Yang Zhou Fried Rice', 388, 746, 5.8, 4.9, 27.7, 1046],
  ['Fried carrot cake', 'Fried Carrot Cake', 271, 732, 9.0, 11.5, 8.9, 427],
  ['Sin chew bee hoon', 'Sin Chew Bee Hoon', 386, 689, 6.6, 5.2, 22.7, 932],
  ['Minced meat mee pok', 'Minced Meat Mee Pok', 383, 677, 8.3, 6.9, 16.6, 1041],
  ['Economical mee goreng', 'Economical Mee Goreng', 350, 677, 3.5, 2.2, 31.9, 1575],
  ['Lor mai kai', 'Lor Mai Kai', 354, 646, 4.2, 1.7, 30.6, 1154],
  ['Laksa', 'Laska', 577, 639, 8.0, 5.3, 18.3, 1380],
  ['Ban mian, dry', 'Ban Mian Dry', 311, 621, 6.7, 4.0, 21.3, 755],
  ['Steamed chicken noodle', 'Steamed Chicken Noodle', 367, 600, 10.8, 3.3, 17.4, 625],
  ['Fried hokkien mee', 'Fried Hokkien Mee', 328, 569, 5.5, 1.5, 25.1, 861],
  ['Char siew wanton noodle', 'Char Siew Wanton Noodle', 335, 502, 7.9, 1.6, 18.4, 731],
  ['Dumpling you mian', 'Dumpling You Mian', 761, 496, 5.5, 2.6, 18.2, 1086],
  ['Ayam penyet', 'Ayam Penyet', 425, 849, 8.9, 9.0, 21.7, 415],
  ['Nasi goreng kampung', 'Nasi Kampung Goreng', 405, 798, 7.1, 7.1, 24.6, 746],
  ['Nasi lemak', 'Nasi Lemak', 395, 785, 9.2, 9.0, 17.7, 459],
  ['Ikan penyet', 'Ikan Penyet', 274, 765, 7.8, 7.0, 22.2, 390],
  ['Nasi ambeng, chicken', 'Nasi Ambang', 630, 733, 9.2, 7.2, 18.3, 919],
  ['Goreng pisang', 'Goreng Pisang', 415, 733, 0.4, 5.6, 30.9, 498],
  ['Tahu goreng set', 'Tahu Goreng', 402, 690, 10.3, 9.9, 8.8, 573],
  ['Mee soto', 'Mee Soto', 281, 640, 9.2, 2.9, 20.3, 798],
  ['Mee bandung', 'Mee Bandung', 466, 622, 7.5, 5.2, 18.1, 625],
  ['Mee bakso', 'Mee Bakso', 435, 611, 5.7, 2.2, 25.9, 734],
  ['Lontong', 'Lotong', 269, 593, 8.2, 6.6, 12.4, 312],
  ['Mee siam', 'Mee Siam', 566, 590, 4.9, 2.7, 24.3, 1156],
  ['Kentang ball with rice cubes', 'Kentang Ball with Rice Cube', 424, 490, 5.4, 3.9, 15.1, 491],
  ['Soto ayam', 'Soto Ayam', 693, 481, 6.2, 1.5, 19.1, 811],
  ['Mee rebus', 'Mee Rebus', 582, 472, 3.7, 2.4, 19.0, 1170],
  ['Appam, plain', 'Original Appam', 344, 1042, 2.9, 5.4, 47.1, 340],
  ['Appam, egg', 'Egg Appam', 304, 884, 4.2, 6.4, 34.7, 254],
  ['Roti prata', 'Roti Prata', 246, 869, 2.5, 6.2, 35.5, 617],
  ['Egg prata with chicken curry', 'Egg Prata with Chicken Curry', 477, 782, 7.7, 7.1, 23.1, 1057],
  ['Mutton biryani, boneless', 'Boneless Mutton Biryani', 459, 728, 8.7, 8.9, 14.7, 868],
  ['Poori set', 'Poori Set', 474, 715, 6.6, 6.8, 21.0, 877],
  ['Masala thosai', 'Marsala Thosai', 569, 714, 7.0, 6.9, 20.2, 999],
  ['Naan set', 'Naan', 597, 697, 5.2, 3.9, 27.5, 1219],
  ['Chapati set with potato', 'Chapatti Set with Potato', 336, 695, 6.0, 6.1, 21.8, 862],
  ['Putu mayam', 'Putu Mayam', 193, 678, 1.8, 2.6, 32.8, 185],
  ['Chapati set with potato masala', 'Chapatti Set with Potato Marsala', 603, 652, 4.5, 3.2, 27.2, 1043],
  ['Idli set', 'Idli Set', 389, 639, 6.1, 6.5, 17.4, 408],
  ['Egg thosai', 'Egg Thosai', 325, 623, 7.5, 5.7, 17.0, 888],
  ['Vegetable biryani', 'Vegetable Biryani', 640, 595, 4.2, 5.6, 18.8, 1100],
  ['Veg set meal, biryani rice', 'Veg Set Meal (Biryani Rice)', 513, 521, 3.6, 3.2, 20.3, 1021],
];

const KJ_PER_KCAL = 4.184;

// Whole plates as sold: { name, paper, grams, kcal, protein, fat, carbs, sodium }.
export const DISHES = ROWS.map(([name, paper, grams, kj, protein, fat, carbs, sodium]) => ({
  name,
  paper,
  grams,
  kcal: Math.round((kj * grams) / 100 / KJ_PER_KCAL),
  protein: Math.round((protein * grams) / 100),
  fat: Math.round((fat * grams) / 100),
  carbs: Math.round((carbs * grams) / 100),
  sodium,
}));

// One line per dish, for the system prompt.
export function dishLines(dishes = DISHES) {
  return dishes.map((d) => `- ${d.name}: ${d.grams} g, ${d.kcal} kcal, protein ${d.protein} g, carbs ${d.carbs} g, fat ${d.fat} g, sodium ${d.sodium} mg`);
}
