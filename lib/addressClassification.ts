export function getNonResidentialReason(address: string): string | null {
  const value = address.trim().toLowerCase();

  if (!value) return null;

  const checks: Array<{ reason: string; pattern: RegExp }> = [
    {
      reason: "an airport or airport terminal",
      pattern:
        /\b(airport|airfield|airport terminal|flight arrivals|flight departures|heathrow|gatwick|stansted|london luton|london city airport)\b/,
    },
    {
      reason: "a hotel or other accommodation",
      pattern:
        /\b(hotel|motel|hostel|guest house|bed and breakfast|b&b|travelodge|premier inn|holiday inn|marriott|hilton|novotel|ibis)\b/,
    },
    {
      reason: "a station or transport terminal",
      pattern:
        /\b(railway station|rail station|train station|coach station|bus station|tube station|underground station|ferry terminal|cruise terminal|seaport)\b|\bstation\b(?!\s+(road|street|lane|close|avenue|drive|way|court|gardens|terrace|house|cottage|view)\b)/,
    },
    {
      reason: "a venue or visitor attraction",
      pattern:
        /\b(stadium|arena|theatre|cinema|museum|gallery|racecourse|conference centre|conference center|event venue|wedding venue|exhibition centre|exhibition center|leisure centre|leisure center|community centre|community center|village hall|town hall|golf club|country club)\b/,
    },
    {
      reason: "a hospital or medical facility",
      pattern:
        /\b(hospital|medical centre|medical center|health centre|health center|clinic|surgery)\b/,
    },
    {
      reason: "a school or college",
      pattern:
        /\b(school|college)\b(?!\s+(road|street|lane|close|avenue|drive|way|court|gardens|terrace|house|cottage|view)\b)|\b(university|academy|nursery)\b/,
    },
    {
      reason: "a business or workplace",
      pattern:
        /\b(business park|industrial estate|trading estate|office|offices|warehouse|factory|distribution centre|distribution center)\b/,
    },
    {
      reason: "a restaurant, pub or bar",
      pattern:
        /\b(restaurant|cafe|café|pub|public house|bar|nightclub)\b/,
    },
  ];

  return checks.find((check) => check.pattern.test(value))?.reason ?? null;
}
