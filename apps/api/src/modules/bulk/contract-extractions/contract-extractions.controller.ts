import { Body, Controller, Post } from '@nestjs/common';
import { ContractExtractionsService } from './contract-extractions.service';
import { ParseContractTextDto } from './dto/parse-contract-text.dto';

@Controller('contract-extractions')
export class ContractExtractionsController {
  constructor(private readonly extractions: ContractExtractionsService) {}

  @Post('parse-text')
  parseText(@Body() dto: ParseContractTextDto) {
    return this.extractions.parseText(dto.sourceText);
  }
}
