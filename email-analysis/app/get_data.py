import json

from database import get_email_data


def main():
    data = get_email_data()

    print(json.dumps(data, indent=4))


if __name__ == "__main__":
    main()