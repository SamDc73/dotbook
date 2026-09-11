import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium"
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold"
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular"
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium"
import { InstrumentSans_400Regular } from "@expo-google-fonts/instrument-sans/400Regular"
import { InstrumentSans_500Medium } from "@expo-google-fonts/instrument-sans/500Medium"
import { InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans/600SemiBold"

// The template's three faces, imported one weight at a time so only these
// seven files ship (the package index would bundle every weight and italic). The keys are the family names tokens.css refers
// to (`--font-display: Fraunces_600SemiBold` …) — expo-font registers each font
// under its key, natively and as @font-face on web, so `font-display` resolves
// everywhere once they have loaded. The keys are assigned rather than written
// as an object literal because they are expo-google-fonts' own identifiers,
// not names of ours to case.
export const FONTS = {}
FONTS.Fraunces_500Medium = Fraunces_500Medium
FONTS.Fraunces_600SemiBold = Fraunces_600SemiBold
FONTS.InstrumentSans_400Regular = InstrumentSans_400Regular
FONTS.InstrumentSans_500Medium = InstrumentSans_500Medium
FONTS.InstrumentSans_600SemiBold = InstrumentSans_600SemiBold
FONTS.IBMPlexMono_400Regular = IBMPlexMono_400Regular
FONTS.IBMPlexMono_500Medium = IBMPlexMono_500Medium
