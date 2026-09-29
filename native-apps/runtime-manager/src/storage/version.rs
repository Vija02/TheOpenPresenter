//! Ordering version strings the way a person would read them.

use std::cmp::Ordering;

/// A version split into the parts that matter for ordering.
struct Parsed<'a> {
    release: Vec<u64>,
    /// Dot-separated prerelease identifiers. Empty for a normal release.
    pre: Vec<&'a str>,
    /// True when every release field was a number.
    numeric: bool,
    raw: &'a str,
}

fn parse(version: &str) -> Parsed<'_> {
    // Build metadata (`+sha`) never affects precedence, per semver.
    let without_build = version.split('+').next().unwrap_or(version);
    let (release, pre) = match without_build.split_once('-') {
        Some((release, pre)) => (release, pre),
        None => (without_build, ""),
    };

    let fields: Vec<Option<u64>> = release.split('.').map(|p| p.parse().ok()).collect();

    Parsed {
        numeric: fields.iter().all(|f| f.is_some()),
        release: fields.iter().map(|f| f.unwrap_or(0)).collect(),
        pre: if pre.is_empty() {
            Vec::new()
        } else {
            pre.split('.').collect()
        },
        raw: version,
    }
}

/// Compare two prerelease identifiers.
fn compare_pre_part(a: &str, b: &str) -> Ordering {
    match (a.parse::<u64>(), b.parse::<u64>()) {
        (Ok(x), Ok(y)) => x.cmp(&y),
        (Ok(_), Err(_)) => Ordering::Less,
        (Err(_), Ok(_)) => Ordering::Greater,
        (Err(_), Err(_)) => a.cmp(b),
    }
}

/// Order two versions oldest-first.
pub fn compare(a: &str, b: &str) -> Ordering {
    let (x, y) = (parse(a), parse(b));

    // Neither is a real version, so there is nothing numeric to order by.
    // Name order at least keeps the list stable between runs.
    if !x.numeric && !y.numeric {
        return x.raw.cmp(y.raw);
    }
    // A parseable version outranks a directory we cannot make sense of.
    if x.numeric != y.numeric {
        return if x.numeric {
            Ordering::Greater
        } else {
            Ordering::Less
        };
    }

    // Compare field by field, treating a missing field as 0 so `1.2` and
    // `1.2.0` are the same version rather than adjacent ones.
    let width = x.release.len().max(y.release.len());
    for i in 0..width {
        let left = x.release.get(i).copied().unwrap_or(0);
        let right = y.release.get(i).copied().unwrap_or(0);
        if left != right {
            return left.cmp(&right);
        }
    }

    // A prerelease precedes the release it leads up to, so `1.0.0-nightly.x`
    // sorts below `1.0.0`. Having no prerelease part is therefore "greater".
    match (x.pre.is_empty(), y.pre.is_empty()) {
        // Equal releases with no prerelease are the same version. Falling back
        // to the raw strings here would make `1.2` and `1.2.0` differ, and
        // would let build metadata change precedence.
        (true, true) => Ordering::Equal,
        (true, false) => Ordering::Greater,
        (false, true) => Ordering::Less,
        (false, false) => {
            for (left, right) in x.pre.iter().zip(y.pre.iter()) {
                let ordering = compare_pre_part(left, right);
                if ordering != Ordering::Equal {
                    return ordering;
                }
            }
            // A longer prerelease is greater when every shared field matches.
            x.pre.len().cmp(&y.pre.len())
        }
    }
}

/// Sort newest-first, which is the order a version list should be read in.
pub fn sort_newest_first(versions: &mut [String]) {
    versions.sort_by(|a, b| compare(b, a));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sorted(input: &[&str]) -> Vec<String> {
        let mut versions: Vec<String> = input.iter().map(|s| s.to_string()).collect();
        sort_newest_first(&mut versions);
        versions
    }

    /// The reported bug: lexicographic order puts 0.0.10 before 0.0.2.
    #[test]
    fn orders_numerically_not_lexicographically() {
        assert_eq!(
            sorted(&["0.0.2", "0.0.10", "0.0.9"]),
            vec!["0.0.10", "0.0.9", "0.0.2"]
        );
    }

    #[test]
    fn orders_across_all_fields() {
        assert_eq!(
            sorted(&["1.2.3", "1.10.0", "2.0.0", "1.9.9"]),
            vec!["2.0.0", "1.10.0", "1.9.9", "1.2.3"]
        );
    }

    /// Nightlies are `0.0.0-nightly.<date>.<sha>`. The date has to drive the
    /// order, and the sha must never be compared numerically.
    #[test]
    fn orders_nightlies_by_date() {
        assert_eq!(
            sorted(&[
                "0.0.0-nightly.20260101.aaaaaaa",
                "0.0.0-nightly.20260929.b1b2b3b",
                "0.0.0-nightly.20260815.ccccccc",
            ]),
            vec![
                "0.0.0-nightly.20260929.b1b2b3b",
                "0.0.0-nightly.20260815.ccccccc",
                "0.0.0-nightly.20260101.aaaaaaa",
            ]
        );
    }

    /// A released version outranks any prerelease of the same number.
    #[test]
    fn ranks_a_release_above_its_prereleases() {
        assert_eq!(
            sorted(&["1.0.0-nightly.20260101.aaa", "1.0.0"]),
            vec!["1.0.0", "1.0.0-nightly.20260101.aaa"]
        );
    }

    /// A stable release and a nightly can coexist; the stable one wins even
    /// though `0.0.0-nightly...` is lexicographically larger than `0.0.2`.
    #[test]
    fn mixes_stable_and_nightly_correctly() {
        assert_eq!(
            sorted(&["0.0.0-nightly.20260929.abc", "0.0.2", "0.0.10"]),
            vec!["0.0.10", "0.0.2", "0.0.0-nightly.20260929.abc"]
        );
    }

    #[test]
    fn compares_numeric_prerelease_parts_numerically() {
        assert_eq!(
            sorted(&["1.0.0-rc.2", "1.0.0-rc.10"]),
            vec!["1.0.0-rc.10", "1.0.0-rc.2"]
        );
    }

    #[test]
    fn ignores_build_metadata_for_precedence() {
        assert_eq!(compare("1.0.0+aaa", "1.0.0+zzz"), Ordering::Equal);
    }

    #[test]
    fn treats_missing_fields_as_zero() {
        assert_eq!(compare("1.2", "1.2.0"), Ordering::Equal);
    }

    /// Whatever is on disk has to sort somewhere rather than panicking.
    #[test]
    fn keeps_unparseable_names_in_a_stable_order() {
        let out = sorted(&["not-a-version", "1.0.0", "also bad"]);
        assert_eq!(out.len(), 3);
        assert_eq!(out[0], "1.0.0");
    }
}
