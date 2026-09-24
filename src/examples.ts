export const examples = {
  largeBox: {
    title: "大きめの収納ボックス（22 × 14 × 8 cm）",
    code: `// 大きめの収納ボックス：22 × 14 × 8 cm
// OpenSCADの数値はmmで指定します
width = 220;
depth = 140;
height = 80;
wall = 3;
$fn = 48;

difference() {
  cube([width, depth, height]);
  // 上が開いた箱。底の厚さも3mmです
  translate([wall, wall, wall])
    cube([width - 2*wall, depth - 2*wall, height]);
  // 左右の持ち手
  for (x = [-1, width - wall - 1])
    hull() {
      for (y = [depth/2 - 20, depth/2 + 20])
        translate([x, y, height - 18])
          rotate([0, 90, 0])
            cylinder(h = wall + 2, r = 7);
    }
}
`,
  },
  bracket: {
    title: "穴あきブラケット",
    code: `// 穴あきブラケット\n// 数値の単位は mm です\n$fn = 48;\nwidth = 40;\nheight = 35;\nthickness = 4;\nhole = 5;\n\nmodule bracket() {\n  difference() {\n    union() {\n      cube([width, 30, thickness]);\n      cube([width, thickness, height]);\n    }\n    // 底面の取り付け穴\n    for (x = [10, 30]) {\n      translate([x, 20, -1])\n        cylinder(h = thickness + 2, d = hole);\n    }\n    // 背面の取り付け穴\n    for (x = [10, 30]) {\n      translate([x, thickness + 1, 24])\n        rotate([90, 0, 0])\n          cylinder(h = thickness + 2, d = hole);\n    }\n  }\n}\n\nbracket();\n`,
  },
  phone: {
    title: "スマホスタンド",
    code: `// スマホスタンド / mm\n$fn = 32;\nwidth = 65;\nunion() {\n  cube([width, 65, 4]);\n  translate([0, 5, 0]) cube([width, 4, 12]);\n  hull() {\n    translate([0, 24, 2]) cube([width, 5, 2]);\n    translate([0, 46, 66]) cube([width, 5, 2]);\n  }\n  // 背面を支えるリブ\n  for (x = [5, width - 9])\n    hull() {\n      translate([x, 42, 2]) cube([4, 18, 2]);\n      translate([x, 46, 50]) cube([4, 4, 2]);\n    }\n}\n`,
  },
  holder: {
    title: "ドリンクホルダー",
    code: `// 卓上ドリンクホルダー / mm\n$fn = 64;\ninner_diameter = 70;\nwall = 3;\nheight = 45;\ndifference() {\n  cylinder(h = height, d = inner_diameter + wall * 2);\n  translate([0, 0, wall])\n    cylinder(h = height, d = inner_diameter);\n  // 側面の窓\n  for (angle = [0 : 90 : 270])\n    rotate([0, 0, angle])\n      translate([0, 0, 24])\n        rotate([90, 0, 0])\n          cylinder(h = 45, d = 22);\n}\n`,
  },
  basics: {
    title: "基本形状の組み合わせ",
    code: `// cube / sphere / cylinder / hull\n$fn = 32;\nunion() {\n  cube([50, 25, 3]);\n  translate([10, 12, 3]) cylinder(h = 18, r = 6);\n  translate([37, 12, 8]) sphere(r = 8);\n  hull() {\n    translate([10, 12, 3]) sphere(r = 4);\n    translate([37, 12, 3]) sphere(r = 4);\n  }\n}\n`,
  },
} as const;
