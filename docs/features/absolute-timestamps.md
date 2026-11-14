# Real dates

**ID** `absolute-timestamps` · **Off by default** · **Code** [`src/features/absolute-timestamps/`](../../src/features/absolute-timestamps/)

Shows the date of each post instead of "5h" or "2d". Hover a date to see the full date and time. Turning the feature off restores Threads' text.

## Options

| Option                         | Values                                                                                                                                      | Default            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Date format                    | Medium (Nov 13, 2026), Short (11/13/26), Long (November 13, 2026), ISO (2026-11-13), US (11/13/2026), European (13/11/2026), Custom pattern | Medium             |
| Show the time                  | On or off                                                                                                                                   | On                 |
| Keep "5h" in front of the date | On or off                                                                                                                                   | Off                |
| Custom pattern                 | Up to 60 characters                                                                                                                         | `YYYY-MM-DD HH:mm` |

The settings page shows a live preview.

## Custom pattern

The custom pattern is used when the date format is "Custom pattern".

| Token         | Meaning                    |
| ------------- | -------------------------- |
| `YYYY`, `YY`  | Year (2026, 26)            |
| `MM`, `M`     | Month number (01, 1)       |
| `MMMM`, `MMM` | Month name (November, Nov) |
| `DD`, `D`     | Day (05, 5)                |
| `dddd`, `ddd` | Weekday (Friday, Fri)      |
| `HH`, `H`     | Hour, 24-hour (09, 9)      |
| `hh`, `h`     | Hour, 12-hour (09, 9)      |
| `mm`          | Minutes                    |
| `ss`          | Seconds                    |
| `A`           | AM or PM                   |

Put other text in brackets. Examples:

| Pattern               | Result                |
| --------------------- | --------------------- |
| `YYYY-MM-DD HH:mm`    | 2026-11-13 09:45      |
| `ddd, MMM D · h:mm A` | Fri, Nov 13 · 9:45 AM |
| `[Posted] D MMMM`     | Posted 13 November    |
