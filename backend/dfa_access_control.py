"""Deterministic access-control engine for AccessGuard."""
ZONES={"Lobby":"CF","Server Room":"CPR","Laboratory":"CFS","Executive Lounge":"CVP","Research Wing":"CFRB","Conference Hall":"CS","Data Center":"CPFR","Admin Office":"CPA"}

def verify(zone: str, sequence: str) -> bool:
    normalized="".join(sequence.upper().split())
    return ZONES.get(zone)==normalized

if __name__=="__main__":
    print("Available zones:", ", ".join(ZONES))
    zone=input("Zone: ").strip()
    sequence=input("Authentication sequence: ")
    print("ACCESS GRANTED" if verify(zone,sequence) else "ACCESS DENIED")
