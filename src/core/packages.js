/**
 * Which package a function comes from (D53).
 *
 * Students run the same code in RStudio, where a function from a package works only
 * after `library()`. The trainer has every function loaded at once, so without a
 * label nothing tells `if_else()` (dplyr) from `ifelse()` (base R). Anything not
 * listed here is base R, as long as the trainer itself provides it.
 */

const PACKAGES = {
  // tibble() lives in the tibble package; library(dplyr) makes it available, and
  // that is what a student types.
  dplyr: ['filter', 'select', 'mutate', 'transmute', 'arrange', 'desc', 'group_by', 'ungroup',
    'summarise', 'summarize', 'count', 'n', 'slice', 'distinct', 'rename', 'pull', 'if_else',
    'case_when', 'left_join', 'right_join', 'inner_join', 'full_join', 'semi_join', 'anti_join',
    'tibble'],
  tidyr: ['pivot_wider', 'pivot_longer', 'drop_na'],
  stringr: ['str_length', 'str_detect', 'str_subset', 'str_which', 'str_count', 'str_extract',
    'str_extract_all', 'str_replace', 'str_replace_all', 'str_split', 'str_sub', 'str_to_upper',
    'str_to_lower', 'str_to_title', 'str_trim', 'str_squish', 'str_c', 'str_starts', 'str_ends',
    'str_pad', 'fixed', 'coll'],
  ggplot2: ['ggplot', 'aes', 'geom_col', 'geom_bar', 'geom_text', 'labs', 'ggtitle', 'xlab', 'ylab',
    'coord_flip', 'theme', 'theme_bw', 'theme_classic', 'theme_gray', 'theme_grey', 'theme_light',
    'theme_minimal', 'position_dodge', 'position_stack', 'position_fill', 'layer_data'],
  forcats: ['fct_reorder', 'fct_infreq', 'fct_rev', 'fct_inorder', 'fct_relevel'],
};

const OF = new Map(Object.entries(PACKAGES).flatMap(([pkg, names]) => names.map((n) => [n, pkg])));

/** The package of a function the trainer provides: a name like "dplyr", or "base". */
export const packageOf = (name) => OF.get(name) || 'base';

/** The packages in the order a course meets them, for lists that name several. */
export const PACKAGE_ORDER = Object.keys(PACKAGES);

/** Every function listed with a package, for the check that each one exists. */
export const PACKAGED = [...OF.keys()];
