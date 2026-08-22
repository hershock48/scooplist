import "server-only";

/**
 * The tavern vertical's first-run seed: Cascarelli's of Homer's real bar
 * program, August 2026 - the same precedent as the default seed, where the
 * first client's real board IS the demo data (True North, seed.ts). The
 * canonical source is cascarellis/src/data/bar.ts; this file is GENERATED
 * from it (tools in the cascarellis repo), and any drift is self-healing
 * because cascarellis/tools/populate-scooplist.mjs matches by name+category
 * and updates in place whenever it is run.
 *
 * A deployment gets this seed only when its configured categories cover
 * every key below - i.e. it is shaped exactly like the Cascarelli's tavern
 * install. Anything else with custom categories still starts empty.
 */

export const BAR_SEED_KEYS = [
  "taps",
  "spumante",
  "bianco",
  "rosso",
  "mules",
  "martinis",
  "whiskey",
  "fun",
  "mocktails",
  "na",
] as const;

export type BarSeedRow = {
  category: string;
  name: string;
  producer: string;
  abv: string;
  tags: string[];
  description: string;
  sizes: { label: string; price: string }[];
};

/* 89 rows: taps, three wine boards, four cocktail boards, two zero-proof. */
export const BAR_SEED: BarSeedRow[] = [
  {"category":"taps","name":"M-43 Orange Cream","producer":"Old Nation Brewery","abv":"6.8","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Bell's Flyover Lager","producer":"Bell's Brewery","abv":"4.5","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Tulip Time Ale","producer":"Big Lake Brewery","abv":"4.2","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Salted Caramel Porter","producer":"Pigeon Hill Brewing Co.","abv":"6","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Rubaeus on Nitro","producer":"Founders Brewing","abv":"5.7","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Wild Bill's Non-Alc Root Beer","producer":"Wild Bill's Craft Beverage Co.","abv":"","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Short's Soft Parade Shandy","producer":"Short's Brewing","abv":"3.2","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Strawberry Blonde Ale","producer":"Arbor Brewing Co.","abv":"6.8","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Pineapple IPA","producer":"Three Blondes Brewing","abv":"7.5","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Pabst Blue Ribbon","producer":"Pabst Brewing","abv":"","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Razzmanien Devil","producer":"Two Bandits Brewing","abv":"4.7","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Bell's Oberon","producer":"Bell's Brewery","abv":"5.8","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Wake & Lake Pilsner","producer":"Three Blondes Brewing","abv":"5.5","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Bell's Two Hearted","producer":"Bell's Brewery","abv":"7.0","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Millions of Peaches","producer":"Odd Brothers Craft Cider","abv":"6.5","tags":["local"],"description":"","sizes":[]},
  {"category":"taps","name":"English Drizzle","producer":"Ramshackle Brewing","abv":"7.1","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Bell's Amber","producer":"Bell's Brewery","abv":"5.8","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Dirty Blonde","producer":"Atwater Brewing","abv":"","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"Vanilla Java Porter","producer":"Atwater Brewing","abv":"5.0","tags":[],"description":"","sizes":[]},
  {"category":"taps","name":"All Day IPA","producer":"Founders Brewing","abv":"4.7","tags":[],"description":"","sizes":[]},
  {"category":"spumante","name":"Prosecco","producer":"Ca' Furlan 'Cuvee Beatrice' ~ Italy","abv":"","tags":[],"description":"White peach, lemon, melon, and pear","sizes":[{"label":"Glass","price":"$10"},{"label":"Bottle","price":"$39"}]},
  {"category":"spumante","name":"Sparkling Peach","producer":"Bronconess ~ Michigan","abv":"","tags":[],"description":"Vibrant juicy peach and honey","sizes":[{"label":"Glass","price":"$9"},{"label":"Bottle","price":"$35"}]},
  {"category":"spumante","name":"Raspberry Sparkling","producer":"Bronconess ~ Michigan","abv":"","tags":[],"description":"Rich juicy red raspberry, lively effervescence","sizes":[{"label":"Glass","price":"$9"},{"label":"Bottle","price":"$35"}]},
  {"category":"spumante","name":"Sweet Red","producer":"Sangue di Giuda ~ Italy","abv":"","tags":["organic"],"description":"Fruit-forward wine with dark cherry, blackberry, and baking spice","sizes":[{"label":"Glass","price":"$10"},{"label":"Bottle","price":"$39"}]},
  {"category":"bianco","name":"Pinot Grigio","producer":"Rosati ~ Italy","abv":"","tags":["organic","vegan"],"description":"Clean, crisp and refreshing, with notes of apple and pear","sizes":[{"label":"Glass","price":"$8"},{"label":"Bottle","price":"$31"}]},
  {"category":"bianco","name":"Pinot Gris","producer":"The Ned ~ New Zealand","abv":"","tags":["vegan"],"description":"Lush and bright with juicy white peach","sizes":[{"label":"Glass","price":"$12"},{"label":"Bottle","price":"$47"}]},
  {"category":"bianco","name":"Sauvignon Blanc","producer":"Fernlands ~ New Zealand","abv":"","tags":[],"description":"Crisp kiwi, white peach and honeydew","sizes":[{"label":"Glass","price":"$10"},{"label":"Bottle","price":"$39"}]},
  {"category":"bianco","name":"Unoaked Chardonnay","producer":"De Wetshof 'Limestone Hill' ~ South Africa","abv":"","tags":[],"description":"Refreshing, bright and crisp with playful acidity","sizes":[{"label":"Glass","price":"$12"},{"label":"Bottle","price":"$43"}]},
  {"category":"bianco","name":"Chardonnay","producer":"Wente 'Morning Fog' ~ California","abv":"","tags":[],"description":"Medium body with subtle oak nuances of sweet cream and vanilla","sizes":[{"label":"Glass","price":"$10"},{"label":"Bottle","price":"$39"}]},
  {"category":"bianco","name":"Chardonnay","producer":"Chalk Hill ~ California","abv":"","tags":[],"description":"Balanced acidity, minerality, and toasted oak notes","sizes":[{"label":"Bottle","price":"$43"}]},
  {"category":"bianco","name":"Rosé","producer":"Sophie Bertin Vin de France ~ France","abv":"","tags":["organic","vegan"],"description":"Soft and floral with a juicy strawberry finish","sizes":[{"label":"Glass","price":"$11"},{"label":"Bottle","price":"$43"}]},
  {"category":"bianco","name":"Moscato d'Asti","producer":"Ricossa ~ Italy","abv":"","tags":["organic"],"description":"Floral and citrus notes with bright tropical fruit","sizes":[{"label":"Glass","price":"$9"},{"label":"Bottle","price":"$35"}]},
  {"category":"bianco","name":"Riesling","producer":"Dr. Hermann 'H' ~ Germany","abv":"","tags":[],"description":"Medium dry with balanced viscosity and acidity","sizes":[{"label":"Glass","price":"$10"},{"label":"Bottle","price":"$39"}]},
  {"category":"rosso","name":"Pinot Noir","producer":"Compton ~ Oregon","abv":"","tags":["organic","vegan"],"description":"Silky texture with light red berries and cocoa","sizes":[{"label":"Glass","price":"$11"},{"label":"Bottle","price":"$43"}]},
  {"category":"rosso","name":"Pinot Noir","producer":"Fog Mountain ~ California","abv":"","tags":[],"description":"Bright, mouthwatering cherry and cranberry","sizes":[{"label":"Glass","price":"$9"},{"label":"Bottle","price":"$35"}]},
  {"category":"rosso","name":"Chianti DOCG","producer":"Guiliano Rosati ~ Italy","abv":"","tags":["organic"],"description":"Bright red fruit, light and easy-drinking","sizes":[{"label":"Glass","price":"$9"},{"label":"Bottle","price":"$35"}]},
  {"category":"rosso","name":"Merlot","producer":"Fog Mountain ~ California","abv":"","tags":[],"description":"Fruit-forward wine with dark cherry, blackberry, and baking spice","sizes":[{"label":"Glass","price":"$9"},{"label":"Bottle","price":"$35"}]},
  {"category":"rosso","name":"Super Tuscan Red Blend","producer":"Monte Antico ~ Italy","abv":"","tags":["vegan"],"description":"Full-bodied with dark berries and gentle tannin finish","sizes":[{"label":"Glass","price":"$10"},{"label":"Bottle","price":"$39"}]},
  {"category":"rosso","name":"Valpolicella Ripasso","producer":"Le Preare ~ Italy","abv":"","tags":["organic"],"description":"Bold, balanced cherry and plum with hints of chocolate","sizes":[{"label":"Bottle","price":"$55"}]},
  {"category":"rosso","name":"Malbec","producer":"Domaine Bousquet ~ Argentina","abv":"","tags":["organic","vegan"],"description":"Easy drinking with lively acid, cassis and blackberry","sizes":[{"label":"Glass","price":"$9"},{"label":"Bottle","price":"$35"}]},
  {"category":"rosso","name":"Cabernet Franc","producer":"Marland ~ Michigan","abv":"","tags":["organic"],"description":"Prominent cherry and vegetal notes with a hint of pepper","sizes":[{"label":"Bottle","price":"$45"}]},
  {"category":"rosso","name":"Cabernet Sauvignon","producer":"Fog Mountain ~ California","abv":"","tags":[],"description":"Blackberry, ripe plum and delicate vanilla oak","sizes":[{"label":"Glass","price":"$9"},{"label":"Bottle","price":"$35"}]},
  {"category":"rosso","name":"Cabernet Sauvignon","producer":"Tagaro 'Fuga' ~ Italy","abv":"","tags":["organic","vegan"],"description":"Full-bodied, rich caramel, coffee, chocolate and tobacco","sizes":[{"label":"Glass","price":"$12"},{"label":"Bottle","price":"$47"}]},
  {"category":"rosso","name":"Zinfandel","producer":"7 Deadly Zins ~ California","abv":"","tags":[],"description":"Jammy, intense blackberry and plum","sizes":[{"label":"Glass","price":"$10"},{"label":"Bottle","price":"$39"}]},
  {"category":"mules","name":"Classic Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"mules","name":"Strawberry Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"mules","name":"Blueberry Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"mules","name":"Mango Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"mules","name":"Peach Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"mules","name":"Limoncello Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"mules","name":"Cranberry Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"mules","name":"Gin Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"mules","name":"Mexican Moscow Mule","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"martinis","name":"Lemon Drop Martini","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$11"}]},
  {"category":"martinis","name":"Raspberry Lemon Drop Martini","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$11.50"}]},
  {"category":"martinis","name":"Dirty Martini","producer":"","abv":"","tags":[],"description":"Made with vodka or gin","sizes":[{"label":"Each","price":"$11"}]},
  {"category":"martinis","name":"Espresso Martini","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"martinis","name":"Chocolate Martini","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"whiskey","name":"Galliano Old Fashioned","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"whiskey","name":"George Sr. Perfect Manhattan","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"whiskey","name":"Apple Bomb","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$9.50"}]},
  {"category":"fun","name":"Cascarelli's Italian Margarita","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$10"}]},
  {"category":"fun","name":"Cascarelli's Classic Margarita","producer":"","abv":"","tags":[],"description":"Make it spicy","sizes":[{"label":"Each","price":"$10"}]},
  {"category":"fun","name":"Cascarelli's Pink Drink","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"fun","name":"Pixi Stick","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$9.75"}]},
  {"category":"fun","name":"Pina Colada","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$10"}]},
  {"category":"fun","name":"Strawberry Daiquiri","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$10"}]},
  {"category":"fun","name":"Miami Vice","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$11"}]},
  {"category":"fun","name":"Italian Sunset","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$12"}]},
  {"category":"fun","name":"Tequila Sunrise","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$9"}]},
  {"category":"fun","name":"Top Shelf Long Island","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$15"}]},
  {"category":"fun","name":"Dirty Shirley","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$10"}]},
  {"category":"fun","name":"Cosmopolitan","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$11"}]},
  {"category":"fun","name":"White Russian","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$9"}]},
  {"category":"fun","name":"Blue Hawaiian","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$10"}]},
  {"category":"mocktails","name":"Virgin Moscow Mule","producer":"","abv":"","tags":[],"description":"Choose your flavor","sizes":[{"label":"Each","price":"$8"}]},
  {"category":"mocktails","name":"Sunrise Mocktail","producer":"","abv":"","tags":[],"description":"Pineapple juice, grenadine, lemon lime soda","sizes":[{"label":"Each","price":"$8"}]},
  {"category":"mocktails","name":"Raspberry / Strawberry Fizz","producer":"","abv":"","tags":[],"description":"Lime juice, soda water, raspberry or strawberry syrup","sizes":[{"label":"Each","price":"$8"}]},
  {"category":"na","name":"Pepsi Products","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$3.25"}]},
  {"category":"na","name":"Craft Brewed Root Beer","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$4.50"}]},
  {"category":"na","name":"Strawberry / Raspberry Lemonade","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$3.75"}]},
  {"category":"na","name":"San Pellegrino Mineral Water","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$6.25"}]},
  {"category":"na","name":"Raspberry Iced Tea","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$3.50"}]},
  {"category":"na","name":"Fresh Brewed Iced Tea / Tazo Hot Tea","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$3.75"}]},
  {"category":"na","name":"Fresh Ground Coffee","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$4"}]},
  {"category":"na","name":"Labatt's N/A","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$5"}]},
  {"category":"na","name":"Blue Moon N/A","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$5"}]},
  {"category":"na","name":"Apple Juice","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$3.25"}]},
  {"category":"na","name":"Milk or Chocolate Milk","producer":"","abv":"","tags":[],"description":"","sizes":[{"label":"Each","price":"$3.95"}]},
];
