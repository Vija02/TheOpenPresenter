import { styled } from "@/styled-system/jsx";
import Link from "next/link";

export default function Header() {
  return (
    <styled.header
      position="absolute"
      top={{ base: 4, md: 6 }}
      w="full"
      zIndex={30}
      pb={{ base: 4, md: 6 }}
      borderBottomWidth="1px"
      _dark={{
        shadow: "none",
        borderImage:
          "linear-gradient(to right,transparent,token(colors.indigo.300/16),transparent) 1",
      }}
      borderImage="linear-gradient(to right,transparent,token(colors.indigo.300/40),transparent) 1"
      boxShadow="0 1px 0 0 token(colors.white/2)"
    >
      <styled.div px={{ base: 4, sm: 6 }}>
        <styled.div maxW="3xl" mx="auto">
          <styled.div
            position="relative"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            columnGap="2"
            h={12}
            bg="#050505"
            rounded="lg"
            px={3}
            shadow="md"
          >
            {/* Site branding */}
            <styled.div flex={1} h="full" w="full">
              {/* Logo */}
              <Link href="/">
                <styled.svg
                  w="full"
                  maxH="full"
                  py={2}
                  viewBox="0 0 1109 316"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M544.371 146V59.2571H510.467V48.8362H589.284V59.2571H555.379V146H544.371ZM595.071 146V43.2588H606.079V84.0617C608.721 80.5392 611.95 77.5548 615.766 75.1086C619.582 72.6624 624.475 71.4392 630.444 71.4392C635.532 71.4392 640.277 72.6624 644.681 75.1086C649.182 77.4569 652.802 81.0284 655.542 85.823C658.379 90.5198 659.798 96.3418 659.798 103.289V146H648.79V103.583C648.79 96.9288 646.882 91.5961 643.066 87.5843C639.25 83.4746 634.309 81.4198 628.242 81.4198C624.132 81.4198 620.414 82.3494 617.087 84.2085C613.76 86.0676 611.07 88.7096 609.015 92.1343C607.058 95.4611 606.079 99.3261 606.079 103.729V146H595.071ZM704.917 147.174C697.481 147.174 690.974 145.511 685.396 142.184C679.819 138.759 675.465 134.16 672.334 128.387C669.3 122.614 667.784 116.254 667.784 109.307C667.784 102.262 669.251 95.9014 672.187 90.2262C675.122 84.4531 679.33 79.9032 684.809 76.5763C690.289 73.1516 696.747 71.4392 704.183 71.4392C711.718 71.4392 718.176 73.1516 723.557 76.5763C729.037 79.9032 733.244 84.4531 736.18 90.2262C739.115 95.9014 740.583 102.262 740.583 109.307V113.71H679.085C679.672 118.015 681.042 121.978 683.195 125.599C685.445 129.121 688.43 131.959 692.148 134.111C695.866 136.166 700.171 137.194 705.064 137.194C710.25 137.194 714.604 136.068 718.127 133.818C721.649 131.469 724.389 128.485 726.346 124.865H738.381C735.837 131.421 731.777 136.802 726.199 141.01C720.72 145.119 713.626 147.174 704.917 147.174ZM679.232 103.436H729.135C728.156 97.1735 725.514 91.9386 721.209 87.7311C716.904 83.5236 711.228 81.4198 704.183 81.4198C697.138 81.4198 691.463 83.5236 687.158 87.7311C682.95 91.9386 680.308 97.1735 679.232 103.436ZM819.038 147.174C811.699 147.174 804.997 145.902 798.93 143.358C792.863 140.814 787.628 137.243 783.225 132.644C778.92 128.045 775.593 122.761 773.245 116.792C770.896 110.726 769.722 104.268 769.722 97.4181C769.722 90.4708 770.896 84.0128 773.245 78.044C775.593 72.0753 778.92 66.7914 783.225 62.1925C787.628 57.5936 792.863 54.0222 798.93 51.4781C804.997 48.934 811.699 47.662 819.038 47.662C826.377 47.662 833.079 48.934 839.146 51.4781C845.212 54.0222 850.398 57.5936 854.704 62.1925C859.107 66.7914 862.483 72.0753 864.831 78.044C867.179 84.0128 868.354 90.4708 868.354 97.4181C868.354 104.268 867.179 110.726 864.831 116.792C862.483 122.761 859.107 128.045 854.704 132.644C850.398 137.243 845.212 140.814 839.146 143.358C833.079 145.902 826.377 147.174 819.038 147.174ZM819.038 136.46C826.964 136.46 833.764 134.747 839.439 131.323C845.212 127.8 849.616 123.103 852.649 117.232C855.78 111.264 857.346 104.659 857.346 97.4181C857.346 90.0794 855.78 83.4746 852.649 77.6037C849.616 71.7328 845.212 67.085 839.439 63.6603C833.764 60.1377 826.964 58.3764 819.038 58.3764C811.21 58.3764 804.409 60.1377 798.636 63.6603C792.863 67.085 788.411 71.7328 785.28 77.6037C782.247 83.4746 780.73 90.0794 780.73 97.4181C780.73 104.659 782.247 111.264 785.28 117.232C788.411 123.103 792.863 127.8 798.636 131.323C804.409 134.747 811.21 136.46 819.038 136.46ZM877.747 175.061V72.6134H888.755V84.3553C891.495 80.3435 895.017 77.2123 899.323 74.9618C903.726 72.6134 908.961 71.4392 915.027 71.4392C922.17 71.4392 928.384 73.1516 933.668 76.5763C939.049 79.9032 943.208 84.4531 946.143 90.2262C949.079 95.9014 950.547 102.262 950.547 109.307C950.547 116.254 949.079 122.614 946.143 128.387C943.208 134.16 939.049 138.759 933.668 142.184C928.384 145.511 922.17 147.174 915.027 147.174C908.961 147.174 903.726 146 899.323 143.652C895.017 141.205 891.495 138.025 888.755 134.111V175.061H877.747ZM913.56 137.194C919.039 137.194 923.687 135.922 927.503 133.378C931.417 130.833 934.402 127.458 936.456 123.25C938.511 118.945 939.539 114.297 939.539 109.307C939.539 104.219 938.511 99.5708 936.456 95.3633C934.402 91.1558 931.417 87.78 927.503 85.2359C923.687 82.6919 919.039 81.4198 913.56 81.4198C908.178 81.4198 903.579 82.6919 899.763 85.2359C895.947 87.78 893.06 91.1558 891.103 95.3633C889.146 99.5708 888.168 104.219 888.168 109.307C888.168 114.297 889.146 118.945 891.103 123.25C893.06 127.458 895.947 130.833 899.763 133.378C903.579 135.922 908.178 137.194 913.56 137.194ZM991.75 147.174C984.313 147.174 977.806 145.511 972.229 142.184C966.651 138.759 962.297 134.16 959.166 128.387C956.133 122.614 954.616 116.254 954.616 109.307C954.616 102.262 956.084 95.9014 959.019 90.2262C961.955 84.4531 966.162 79.9032 971.642 76.5763C977.121 73.1516 983.579 71.4392 991.016 71.4392C998.55 71.4392 1005.01 73.1516 1010.39 76.5763C1015.87 79.9032 1020.08 84.4531 1023.01 90.2262C1025.95 95.9014 1027.42 102.262 1027.42 109.307V113.71H965.918C966.505 118.015 967.875 121.978 970.027 125.599C972.278 129.121 975.262 131.959 978.98 134.111C982.699 136.166 987.004 137.194 991.896 137.194C997.082 137.194 1001.44 136.068 1004.96 133.818C1008.48 131.469 1011.22 128.485 1013.18 124.865H1025.21C1022.67 131.421 1018.61 136.802 1013.03 141.01C1007.55 145.119 1000.46 147.174 991.75 147.174ZM966.064 103.436H1015.97C1014.99 97.1735 1012.35 91.9386 1008.04 87.7311C1003.74 83.5236 998.061 81.4198 991.016 81.4198C983.971 81.4198 978.295 83.5236 973.99 87.7311C969.783 91.9386 967.141 97.1735 966.064 103.436ZM1034.99 146V72.6134H1046V84.0617C1048.64 80.5392 1051.87 77.5548 1055.69 75.1086C1059.51 72.6624 1064.4 71.4392 1070.37 71.4392C1075.46 71.4392 1080.2 72.6624 1084.6 75.1086C1089.11 77.4569 1092.73 81.0284 1095.47 85.823C1098.3 90.5198 1099.72 96.3418 1099.72 103.289V146H1088.71V103.583C1088.71 96.9288 1086.81 91.5961 1082.99 87.5843C1079.17 83.4746 1074.23 81.4198 1068.17 81.4198C1064.06 81.4198 1060.34 82.3494 1057.01 84.2085C1053.68 86.0676 1050.99 88.7096 1048.94 92.1343C1046.98 95.4611 1046 99.3261 1046 103.729V146H1034.99Z"
                    fill="#F8F8F8"
                  />
                  <path
                    d="M520.375 257.609V160.446H564.114C574.486 160.446 582.656 163.283 588.625 168.958C594.593 174.536 597.578 182.119 597.578 191.708C597.578 201.297 594.593 208.93 588.625 214.605C582.656 220.182 574.486 222.971 564.114 222.971H531.383V257.609H520.375ZM531.383 212.697H563.38C571.012 212.697 576.785 210.838 580.699 207.119C584.613 203.401 586.57 198.264 586.57 191.708C586.57 185.25 584.613 180.162 580.699 176.444C576.785 172.726 571.012 170.866 563.38 170.866H531.383V212.697ZM605.787 257.609V184.223H616.795V202.276C617.186 201.004 617.92 199.34 618.996 197.286C620.171 195.133 621.834 192.98 623.987 190.828C626.139 188.675 628.83 186.865 632.059 185.397C635.386 183.831 639.3 183.049 643.801 183.049H644.535V194.057H643.214C637.734 194.057 632.989 195.573 628.977 198.607C625.063 201.542 622.03 205.407 619.877 210.202C617.822 214.898 616.795 219.938 616.795 225.319V257.609H605.787ZM682.701 258.784C675.264 258.784 668.757 257.12 663.18 253.793C657.602 250.369 653.248 245.77 650.117 239.997C647.084 234.224 645.567 227.863 645.567 220.916C645.567 213.871 647.035 207.511 649.97 201.836C652.906 196.063 657.113 191.513 662.593 188.186C668.072 184.761 674.53 183.049 681.967 183.049C689.501 183.049 695.959 184.761 701.341 188.186C706.82 191.513 711.028 196.063 713.963 201.836C716.899 207.511 718.366 213.871 718.366 220.916V225.319H656.868C657.456 229.625 658.825 233.588 660.978 237.208C663.229 240.73 666.213 243.568 669.931 245.721C673.65 247.776 677.955 248.803 682.847 248.803C688.033 248.803 692.388 247.678 695.91 245.427C699.433 243.079 702.172 240.094 704.129 236.474H716.165C713.621 243.03 709.56 248.412 703.983 252.619C698.503 256.729 691.409 258.784 682.701 258.784ZM657.015 215.045H706.918C705.94 208.783 703.298 203.548 698.992 199.34C694.687 195.133 689.012 193.029 681.967 193.029C674.922 193.029 669.246 195.133 664.941 199.34C660.733 203.548 658.092 208.783 657.015 215.045ZM754.126 258.784C747.375 258.784 741.651 257.658 736.954 255.408C732.355 253.157 728.832 250.222 726.386 246.601C723.94 242.883 722.57 238.871 722.277 234.566H733.725C734.018 237.012 734.85 239.41 736.22 241.758C737.688 244.008 739.889 245.868 742.825 247.335C745.76 248.705 749.576 249.39 754.273 249.39C755.741 249.39 757.551 249.243 759.704 248.95C761.856 248.656 763.911 248.118 765.868 247.335C767.923 246.552 769.635 245.378 771.005 243.813C772.375 242.247 773.06 240.241 773.06 237.795C773.06 234.762 771.886 232.413 769.537 230.75C767.189 229.086 764.156 227.814 760.438 226.934C756.719 225.955 752.756 225.026 748.549 224.145C744.439 223.264 740.525 222.139 736.807 220.769C733.089 219.302 730.055 217.296 727.707 214.752C725.359 212.11 724.185 208.538 724.185 204.037C724.185 197.383 726.582 192.246 731.376 188.626C736.269 184.908 743.461 183.049 752.952 183.049C759.41 183.049 764.645 184.076 768.657 186.131C772.766 188.088 775.849 190.632 777.904 193.763C780.056 196.894 781.328 200.27 781.72 203.89H770.565C770.173 200.759 768.608 198.068 765.868 195.818C763.226 193.567 758.823 192.442 752.659 192.442C741.015 192.442 735.193 195.965 735.193 203.01C735.193 205.945 736.367 208.196 738.715 209.761C741.063 211.327 744.097 212.599 747.815 213.577C751.533 214.458 755.447 215.339 759.557 216.219C763.764 217.002 767.727 218.127 771.446 219.595C775.164 221.063 778.197 223.167 780.545 225.906C782.894 228.548 784.068 232.169 784.068 236.768C784.068 243.911 781.328 249.39 775.849 253.206C770.467 256.924 763.226 258.784 754.126 258.784ZM826.401 258.784C818.964 258.784 812.457 257.12 806.88 253.793C801.302 250.369 796.948 245.77 793.817 239.997C790.784 234.224 789.267 227.863 789.267 220.916C789.267 213.871 790.735 207.511 793.67 201.836C796.606 196.063 800.813 191.513 806.293 188.186C811.772 184.761 818.23 183.049 825.667 183.049C833.201 183.049 839.659 184.761 845.041 188.186C850.52 191.513 854.728 196.063 857.663 201.836C860.599 207.511 862.066 213.871 862.066 220.916V225.319H800.569C801.156 229.625 802.525 233.588 804.678 237.208C806.929 240.73 809.913 243.568 813.631 245.721C817.35 247.776 821.655 248.803 826.547 248.803C831.733 248.803 836.088 247.678 839.61 245.427C843.133 243.079 845.872 240.094 847.829 236.474H859.865C857.321 243.03 853.26 248.412 847.683 252.619C842.203 256.729 835.109 258.784 826.401 258.784ZM800.715 215.045H850.618C849.64 208.783 846.998 203.548 842.692 199.34C838.387 195.133 832.712 193.029 825.667 193.029C818.622 193.029 812.946 195.133 808.641 199.34C804.434 203.548 801.792 208.783 800.715 215.045ZM871.114 257.609V184.223H882.122V195.671C884.764 192.149 887.993 189.164 891.809 186.718C895.625 184.272 900.517 183.049 906.486 183.049C911.574 183.049 916.32 184.272 920.723 186.718C925.224 189.066 928.844 192.638 931.584 197.432C934.422 202.129 935.841 207.951 935.841 214.898V257.609H924.833V215.192C924.833 208.538 922.925 203.205 919.108 199.194C915.292 195.084 910.351 193.029 904.284 193.029C900.175 193.029 896.456 193.959 893.13 195.818C889.803 197.677 887.112 200.319 885.057 203.744C883.1 207.07 882.122 210.936 882.122 215.339V257.609H871.114ZM956.049 257.609V193.91H941.079V184.223H956.049V157.95H967.057V184.223H983.936V193.91H967.057V257.609H956.049ZM1022.74 258.784C1015.31 258.784 1008.8 257.12 1003.22 253.793C997.646 250.369 993.292 245.77 990.16 239.997C987.127 234.224 985.61 227.863 985.61 220.916C985.61 213.871 987.078 207.511 990.014 201.836C992.949 196.063 997.157 191.513 1002.64 188.186C1008.12 184.761 1014.57 183.049 1022.01 183.049C1029.54 183.049 1036 184.761 1041.38 188.186C1046.86 191.513 1051.07 196.063 1054.01 201.836C1056.94 207.511 1058.41 213.871 1058.41 220.916V225.319H996.912C997.499 229.625 998.869 233.588 1001.02 237.208C1003.27 240.73 1006.26 243.568 1009.97 245.721C1013.69 247.776 1018 248.803 1022.89 248.803C1028.08 248.803 1032.43 247.678 1035.95 245.427C1039.48 243.079 1042.22 240.094 1044.17 236.474H1056.21C1053.66 243.03 1049.6 248.412 1044.03 252.619C1038.55 256.729 1031.45 258.784 1022.74 258.784ZM997.059 215.045H1046.96C1045.98 208.783 1043.34 203.548 1039.04 199.34C1034.73 195.133 1029.06 193.029 1022.01 193.029C1014.97 193.029 1009.29 195.133 1004.98 199.34C1000.78 203.548 998.135 208.783 997.059 215.045ZM1067.46 257.609V184.223H1078.47V202.276C1078.86 201.004 1079.59 199.34 1080.67 197.286C1081.84 195.133 1083.5 192.98 1085.66 190.828C1087.81 188.675 1090.5 186.865 1093.73 185.397C1097.06 183.831 1100.97 183.049 1105.47 183.049H1106.21V194.057H1104.88C1099.4 194.057 1094.66 195.573 1090.65 198.607C1086.73 201.542 1083.7 205.407 1081.55 210.202C1079.49 214.898 1078.47 219.938 1078.47 225.319V257.609H1067.46Z"
                    fill="#F8F8F8"
                  />
                  <rect
                    y="48.501"
                    width="214.924"
                    height="214.924"
                    fill="#303030"
                  />
                  <rect
                    x="64.3101"
                    y="15.2061"
                    width="215.257"
                    height="215.257"
                    transform="rotate(15 64.3101 15.2061)"
                    fill="#636363"
                  />
                  <rect
                    x="140.745"
                    width="215.257"
                    height="215.257"
                    transform="rotate(30 140.745 0)"
                    fill="#A2A2A2"
                  />
                  <rect
                    x="225.066"
                    y="4.40039"
                    width="215.257"
                    height="215.257"
                    transform="rotate(45 225.066 4.40039)"
                    fill="#C4C4C4"
                  />
                  <rect
                    x="304.371"
                    y="21.6826"
                    width="215.257"
                    height="215.257"
                    transform="rotate(60 304.371 21.6826)"
                    fill="#E5E5E5"
                  />
                </styled.svg>
              </Link>
            </styled.div>
          </styled.div>
        </styled.div>
      </styled.div>
    </styled.header>
  );
}
