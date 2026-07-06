# Quickeye Design System: Bauhaus

## 1. Design Philosophy
Form follows function with pure geometric beauty and primary color theory. Constructivist modernism—every element deliberately composed from circles, squares, and triangles. Evokes 1920s Bauhaus posters: bold, asymmetric, architectural, unapologetically graphic.

**Vibe**: Constructivist, Geometric, Modernist, Artistic-yet-Functional, Bold, Architectural

## 2. Design Token System

### Colors
- `background`: `#F0F0F0` (Off-white canvas)
- `foreground`: `#121212` (Stark Black)
- `primary-red`: `#D02020` (Bauhaus Red)
- `primary-blue`: `#1040C0` (Bauhaus Blue)
- `primary-yellow`: `#F0C020` (Bauhaus Yellow)
- `border`: `#121212` (Thick, distinct borders)
- `muted`: `#E0E0E0`

### Typography
- **Font Family**: 'Outfit' (geometric sans-serif, Google Fonts)
- **Font Import**: `Outfit:wght@400;500;700;900`
- **Display**: text-5xl to text-7xl, font-black (900), uppercase, tracking-tighter
- **Heading**: text-3xl to text-4xl, font-bold (700), uppercase
- **Body**: text-base to text-lg, font-medium (500)
- **Label**: font-bold (700), uppercase, tracking-widest

### Radius & Border
- **Radius**: Either `rounded-none` (0px) or `rounded-full` (circles). No in-between.
- **Border Widths**: 2px or 4px, always black (#121212)
- **Shadows**: Hard offset shadows—`shadow-[4px_4px_0px_0px_#121212]`, `shadow-[8px_8px_0px_0px_#121212]`

### Button Variants
- **Primary Red**: bg-[#D02020] text-white border-4 border-black shadow-[4px_4px_0px_0px_black]
- **Secondary Blue**: bg-[#1040C0] text-white border-4 border-black shadow-[4px_4px_0px_0px_black]
- **Yellow**: bg-[#F0C020] text-black border-4 border-black shadow-[4px_4px_0px_0px_black]
- **Outline**: bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_black]
- **Ghost**: border-none text-black
- **States**: Hover opacity-90, Active (translate-x-[2px] translate-y-[2px] shadow-none)

### Cards
- **Base**: White background, border-4 border-black, shadow-[8px_8px_0px_0px_black]
- **Corner Shape**: Small geometric shape (8px-16px) in corner
- **Hover**: hover:-translate-y-1

## 3. Layout & Spacing
- **Container**: max-w-6xl
- **Section Padding**: Mobile py-8 px-4, Desktop py-16 px-8
- **Grid Gap**: 8px or 16px
- **Section Dividers**: border-b-4 border-black

## 4. Mandatory Bold Choices
- **Color Blocking**: Entire sections use solid primary color backgrounds
- **Geometric Compositions**: Overlapping shapes (circles, squares, triangles)
- **Rotated Elements**: 45-degree rotation on every 3rd shape
- **Hard Shadows**: No soft shadows—always offset black shadows
- **No Gradients**: Solid colors only
- **Uppercase Typography**: Most text is uppercase

## 5. Icons
- **Library**: lucide-react (Circle, Square, Triangle, Check, ArrowRight, ChevronDown)
- **Style**: 2-3px stroke, h-6 to h-8
- **Treatment**: Inside bordered geometric containers or as corner decorations
