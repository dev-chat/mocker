export class ReactionService {
  private positiveReactions = [
    "grinning",
    "grin",
    "joy",
    "rolling_on_the_floor_laughing",
    "smiley",
    "smile",
    "laughing",
    "yum",
    "sunglasses",
    "heart_eyes",
    "hugging_face",
    "drooling_face",
    "triumph",
    "joy_cat",
    "heart_eyes_cat",
    "muscle",
    "point_up",
    "point_up_2",
    "the_horns",
    "ok_hand",
    "+1",
    "clap",
    "raised_hands",
    "pray",
    "heart",
    "purple_heart",
    "blue_heart",
    "green_heart",
    "yellow_heart",
    "orange_heart",
    "black_heart",
    "sparkling_heart",
    "two_hearts",
    "sweat_drops",
    "crown",
    "rocket",
    "fire",
    "tada",
    "confetti_ball",
    "medal",
    "trophy",
    "sports_medal",
    "first_place_medal",
    "moneybag",
    "key",
    "100",
    "bong",
    "chefkiss",
    "clapping",
    "f",
    "feelsgood",
    "healing_of_the_nation",
    "godmode",
    "1000",
    "heavy_check_mark",
    "white_check_mark",
    "chart_with_upwards_trend"
  ];

  private negativeReactions = [
    "face_with_rolling_eyes",
    "rage",
    "angry",
    "face_with_symbols_on_mouth",
    "face_vomiting",
    "clown_face",
    "face_with_hand_over_mouth",
    "skull",
    "skull_and_crossbones",
    "middle_finger",
    "-1",
    "bomb",
    "boom",
    "snowflake",
    "small_red_triangle",
    "99",
    "90",
    "bounce-eyes",
    "butthurt",
    "caged2",
    "alert",
    "bomb2",
    "fake-news",
    "flag",
    "flesh",
    "heh",
    "garbage",
    "k",
    "koolaidtantrum",
    "koz",
    "muzzle",
    "nazi",
    "noose",
    "riddle",
    "salt",
    "thonk",
    "trash",
    "trump",
    "zer0",
    "x",
    "no_entry_sign",
    "dumpster",
    "thx",
    "man-gesturing-no",
    "no_good",
    "chart_with_downwards_trend",
    "zzz",
    "chart_with_downwards_trend"
  ];

  public handleReaction(
    reaction: string,
    affectedUser: string,
    isAdded: boolean
  ) {
    const isPositive = this.isReactionPositive(reaction);
    const isNegative = this.isReactionNegative(reaction);
    if ((isAdded && isPositive) || (!isAdded && isNegative)) {
      // Add rep to affected user.
      console.log("should add rep to ", affectedUser);
    } else if ((isAdded && isNegative) || (!isAdded && isPositive)) {
      // Remove rep from affected_user.
      console.log("should removeRep from ", affectedUser);
    }
  }

  private isReactionPositive(reaction: string) {
    return this.positiveReactions.includes(reaction);
  }

  private isReactionNegative(reaction: string) {
    return this.negativeReactions.includes(reaction);
  }
}
